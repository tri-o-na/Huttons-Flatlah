import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

function parseRemainingLease(lease: string) {
  const parts = lease.match(/(\d+) years?/i);
  return parts ? parseInt(parts[1], 10) : null;
}

router.post('/', async (req, res) => {
  try {
    const towns = req.body.towns as string[] | undefined;
    if (!towns || !Array.isArray(towns) || towns.length === 0 || towns.length > 5) {
      return res.status(400).json({ error: 'Provide 1-5 towns' });
    }

    const comparisons = await Promise.all(towns.map(async (town) => {
      const properties = await prisma.property.findMany({
        where: { town }
      });
      if (properties.length === 0) {
        return { town, error: 'No data available' };
      }

      const totalTransactions = properties.length;

      const priceSum = properties.reduce((sum, p) => sum + p.resale_price, 0);
      const psfSum = properties.reduce((sum, p) => sum + (p.resale_price / (p.floor_area_sqm * 10.764)), 0);

      const avgPrice = priceSum / totalTransactions;
      const avgPsf = psfSum / totalTransactions;
      const flatTypeCounts = properties.reduce((acc, p) => {
        acc[p.flat_type] = (acc[p.flat_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topFlatType = Object.keys(flatTypeCounts).reduce((a, b) => flatTypeCounts[a] > flatTypeCounts[b] ? a : b);
      const avgLeaseDate = Math.round(properties.reduce((sum, p) => sum + p.lease_commence_date, 0) / properties.length);
      const remainingLeaseCounts = properties.reduce((acc, p) => {
        const years = parseRemainingLease(p.remaining_lease);
        if (years !== null) acc[years] = (acc[years] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const mostCommonRemainingLease = Object.keys(remainingLeaseCounts).sort((a, b) => remainingLeaseCounts[Number(b)] - remainingLeaseCounts[Number(a)])[0];

      const priceTrend = Object.entries(properties.reduce((acc, p) => {
        const month = p.month.toISOString().slice(0, 7);
        if (!acc[month]) acc[month] = [];
        acc[month].push(p.resale_price);
        return acc;
      }, {} as Record<string, number[]>)).sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({
        month,
        avg_price: values.reduce((sum, value) => sum + value, 0) / values.length,
        count: values.length
      }));

      return {
        town,
        avg_price: avgPrice,
        avg_psf: avgPsf,
        transaction_volume: totalTransactions,
        top_flat_type: topFlatType,
        avg_lease_commence_date: avgLeaseDate,
        most_common_remaining_lease: mostCommonRemainingLease,
        price_trend: priceTrend,
        flat_type_mix: flatTypeCounts,
        calculations: {
          avg_psf: {
            count: totalTransactions,
            formula: 'psf = resale_price / (floor_area_sqm * 10.764); avg_psf = (sum of transaction psf) / (number of transactions)',
            factors: ['town', 'resale_price', 'floor_area_sqm', 'all available transactions in dataset for that town'],
            sum_psf: psfSum
          },
          avg_price: {
            count: totalTransactions,
            formula: 'avg_price = (sum of transaction resale_price) / (number of transactions)',
            factors: ['town', 'all available transactions in dataset for that town'],
            sum_price: priceSum
          },
          price_trend: {
            formula: 'monthly avg_price = (sum of resale_price in month) / (number of transactions in month)',
            factors: ['town', 'month (YYYY-MM) derived from property.month']
          }
        }
      };
    }));

    res.json(comparisons);
  } catch (error) {
    res.status(500).json({ error: 'Failed to compare towns' });
  }
});

export default router;