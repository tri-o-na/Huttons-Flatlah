import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

function normalizeParam(param?: string) {
  if (!param) return undefined;
  return decodeURIComponent(param).replace(/-/g, ' ').trim();
}

router.get('/', async (req, res) => {
  try {
    const towns = await prisma.property.groupBy({
      by: ['town'],
      _count: { _all: true },
      _avg: { resale_price: true, psf: true }
    });

    const townData = await Promise.all(towns.map(async (t) => {
      const flatTypes = await prisma.property.groupBy({
        by: ['flat_type'],
        where: { town: t.town },
        _count: { _all: true }
      });
      const mostPopular = flatTypes.reduce((a, b) => a._count._all > b._count._all ? a : b).flat_type;
      return {
        town: t.town,
        total_transactions: t._count._all,
        avg_resale_price: t._avg.resale_price,
        avg_psf: t._avg.psf,
        most_popular_flat_type: mostPopular
      };
    }));

    res.json(townData.sort((a, b) => (b.total_transactions - a.total_transactions)));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get towns' });
  }
});

router.get('/:town', async (req, res) => {
  try {
    const town = normalizeParam(req.params.town);
    const properties = await prisma.property.findMany({ where: { town } });

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Town not found' });
    }

    const totalTransactions = properties.length;
    const avgPrice = properties.reduce((sum, p) => sum + p.resale_price, 0) / totalTransactions;
    const avgPsf = properties.reduce((sum, p) => sum + p.psf, 0) / totalTransactions;
    const flatTypeCounts = properties.reduce((acc, p) => {
      acc[p.flat_type] = (acc[p.flat_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostTransactedFlatType = Object.keys(flatTypeCounts).reduce((a, b) => flatTypeCounts[a] > flatTypeCounts[b] ? a : b);

    const flatTypeShare = Object.entries(flatTypeCounts).map(([flat_type, count]) => ({
      flat_type,
      count,
      share: Math.round((count / totalTransactions) * 10000) / 100
    }));

    const priceTrendByFlatType = Object.entries(properties.reduce((acc, p) => {
      const month = p.month.toISOString().slice(0, 7);
      const type = p.flat_type;
      if (!acc[type]) acc[type] = {};
      if (!acc[type][month]) acc[type][month] = [];
      acc[type][month].push(p.resale_price);
      return acc;
    }, {} as Record<string, Record<string, number[]>>)).map(([type, months]) => ({
      flat_type: type,
      data: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, prices]) => ({
        month,
        avg_price: prices.reduce((sum, price) => sum + price, 0) / prices.length
      }))
    }));

    const transactionByYear = Object.entries(properties.reduce((acc, p) => {
      const year = p.month.getFullYear();
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {} as Record<number, number>)).map(([year, count]) => ({ year: Number(year), count }));

    const avgPsfByFlatType = Object.entries(properties.reduce((acc, p) => {
      if (!acc[p.flat_type]) acc[p.flat_type] = { total: 0, count: 0 };
      acc[p.flat_type].total += p.psf;
      acc[p.flat_type].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)).map(([flat_type, data]) => ({
      flat_type,
      avg_psf: data.total / data.count
    }));

    const topStreets = (await prisma.property.groupBy({
      by: ['street_name'],
      where: { town },
      _count: { _all: true },
      _avg: { resale_price: true }
    })).map((row) => ({
      street_name: row.street_name,
      transactions: row._count._all,
      avg_price: row._avg.resale_price
    })).sort((a, b) => b.transactions - a.transactions).slice(0, 10);

    const priceByTypeAndYear = properties.reduce((acc, p) => {
      const year = p.month.getFullYear();
      if (!acc[p.flat_type]) acc[p.flat_type] = {};
      if (!acc[p.flat_type][year]) acc[p.flat_type][year] = [];
      acc[p.flat_type][year].push(p.resale_price);
      return acc;
    }, {} as Record<string, Record<number, number[]>>);

    const yoyChange = Object.entries(priceByTypeAndYear).map(([flat_type, years]) => {
      const sortedYears = Object.keys(years).map(Number).sort((a, b) => a - b);
      const currentYear = sortedYears[sortedYears.length - 1];
      const priorYear = sortedYears[sortedYears.length - 2];
      const currentAvg = years[currentYear]?.reduce((sum, v) => sum + v, 0) / years[currentYear].length;
      const priorAvg = priorYear ? years[priorYear]?.reduce((sum, v) => sum + v, 0) / years[priorYear].length : undefined;
      return {
        flat_type,
        current_year: currentYear,
        prior_year: priorYear || null,
        change_pct: priorAvg ? Math.round(((currentAvg - priorAvg) / priorAvg) * 10000) / 100 : null
      };
    });

    res.json({
      kpis: {
        total_transactions: totalTransactions,
        avg_price: avgPrice,
        avg_psf: avgPsf,
        most_transacted_flat_type: mostTransactedFlatType
      },
      charts: {
        priceTrendByFlatType,
        transactionByYear: transactionByYear.sort((a, b) => a.year - b.year),
        flatTypeShare,
        topStreets,
        avgPsfByFlatType,
        yoyChange
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get town analytics' });
  }
});

export default router;