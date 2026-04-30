import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

function parseRange(value?: string | string[]) {
  if (!value) return undefined;
  const parsed = parseInt(Array.isArray(value) ? value[0] : value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeParam(param?: string) {
  if (!param) return undefined;
  return decodeURIComponent(param).replace(/-/g, ' ').trim();
}

function formatSuggestionPath(town: string, street: string, block: string) {
  return `/property/${encodeURIComponent(town.replace(/\s+/g, '-'))}/${encodeURIComponent(street.replace(/\s+/g, '-'))}/${encodeURIComponent(block)}`;
}

type OrderByType =
  | { _avg: { resale_price: 'desc' | 'asc' } }
  | { _avg: { psf: 'desc' | 'asc' } }
  | { _max: { month: 'desc' | 'asc' } };

router.get('/stats', async (_req, res) => {
  try {
    const agg = await prisma.property.aggregate({
      _min: { resale_price: true, psf: true },
      _max: { resale_price: true, psf: true },
    });
    res.json({
      minPrice: agg._min.resale_price ?? 0,
      maxPrice: agg._max.resale_price ?? 0,
      minPsf: agg._min.psf ?? 0,
      maxPsf: agg._max.psf ?? 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.json([]);
    }

    const qLower = q.toLowerCase();
    const where = {
      OR: [
        { town: { contains: qLower } },
        { street_name: { contains: qLower } },
        { block: { contains: qLower } },
        { flat_type: { contains: qLower } }
      ]
    };

    const suggestionGroups = await prisma.property.groupBy({
      by: ['town', 'street_name', 'block', 'flat_type'],
      where,
      _max: { month: true },
      orderBy: [{ _max: { month: 'desc' } }],
      take: 12
    });

    const suggestions = suggestionGroups.map((row) => ({
      label: `${row.town} • ${row.street_name} • ${row.block} • ${row.flat_type}`,
      town: row.town,
      street: row.street_name,
      block: row.block,
      flat_type: row.flat_type,
      path: formatSuggestionPath(row.town, row.street_name, row.block)
    }));

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const flatType = req.query.flatType as string | undefined;
    const town = normalizeParam(req.query.town as string | undefined);
    const street = normalizeParam(req.query.street as string | undefined);
    const block = req.query.block as string | undefined;
    const storeyRange = req.query.storeyRange as string | undefined;
    const minPrice = parseRange(req.query.minPrice as string | undefined);
    const maxPrice = parseRange(req.query.maxPrice as string | undefined);
    const minArea = parseFloat(req.query.minArea as string || '0');
    const maxArea = parseFloat(req.query.maxArea as string || '0');
    const sortBy = (req.query.sortBy as string || 'latest');
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit as string || '50', 10)));

    const where: any = {};
    if (q) {
      const qLower = q.toLowerCase();
      where.OR = [
        { town: { contains: qLower } },
        { street_name: { contains: qLower } },
        { block: { contains: qLower } },
        { flat_type: { contains: qLower } }
      ];
    }
    if (flatType) where.flat_type = flatType;
    if (town) where.town = { contains: town.toLowerCase() };
    if (street) where.street_name = { contains: street.toLowerCase() };
    if (block) where.block = { contains: block.toLowerCase() };
    if (storeyRange) where.storey_range = storeyRange;
    if (minPrice || maxPrice) {
      where.resale_price = {};
      if (minPrice) where.resale_price.gte = minPrice;
      if (maxPrice) where.resale_price.lte = maxPrice;
    }
    if (minArea || maxArea) {
      where.floor_area_sqm = {};
      if (!Number.isNaN(minArea) && minArea > 0) where.floor_area_sqm.gte = minArea;
      if (!Number.isNaN(maxArea) && maxArea > 0) where.floor_area_sqm.lte = maxArea;
    }

    let orderBy: OrderByType[];
    if (sortBy === 'highest_price') {
      orderBy = [{ _avg: { resale_price: 'desc' } }];
    } else if (sortBy === 'lowest_price') {
      orderBy = [{ _avg: { resale_price: 'asc' } }];
    } else if (sortBy === 'highest_psf') {
      orderBy = [{ _avg: { psf: 'desc' } }];
    } else if (sortBy === 'lowest_psf') {
      orderBy = [{ _avg: { psf: 'asc' } }];
    } else {
      orderBy = [{ _max: { month: 'desc' } }];
    }

    const properties = await prisma.property.groupBy({
      by: ['town', 'street_name', 'block'],
      where,
      _count: { _all: true },
      _avg: { resale_price: true, psf: true },
      _max: { month: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    });

    const totalGroups = (await prisma.property.groupBy({
      by: ['town', 'street_name', 'block'],
      where,
      _count: { _all: true }
    })).length;

    const totalPages = Math.ceil(totalGroups / limit);

    res.json({
      data: properties.map((p: {
        town: string;
        street_name: string;
        block: string;
        _count: { _all: number };
        _avg: { resale_price: number | null; psf: number | null };
        _max: { month: Date | null };
      }) => ({
        town: p.town,
        street_name: p.street_name,
        block: p.block,
        avg_resale_price: p._avg.resale_price,
        avg_psf: p._avg.psf,
        total_transactions: p._count._all,
        latest_transaction_month: p._max.month?.toISOString().slice(0, 7)
      })),
      total: totalGroups,
      page,
      totalPages
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search properties', details: String(error) });
  }
});

router.get('/:town/:street/:block', async (req, res) => {
  try {
    const town = normalizeParam(req.params.town);
    const street = normalizeParam(req.params.street);
    const block = req.params.block;

    const properties = await prisma.property.findMany({
      where: { town, street_name: street, block },
      orderBy: { month: 'asc' }
    });

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const header = {
      block: properties[0].block,
      street_name: properties[0].street_name,
      town: properties[0].town,
      flat_model: properties[0].flat_model,
      lease_commence_date: properties[0].lease_commence_date,
      remaining_lease: properties[0].remaining_lease
    };

    const avgPrice = properties.reduce((sum, p) => sum + p.resale_price, 0) / properties.length;
    const avgPsf = properties.reduce((sum, p) => sum + p.psf, 0) / properties.length;
    const highestPrice = Math.max(...properties.map((p) => p.resale_price));
    const lowestPrice = Math.min(...properties.map((p) => p.resale_price));
    const flatTypeCounts = properties.reduce((acc, p) => {
      acc[p.flat_type] = (acc[p.flat_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommonFlatType = Object.keys(flatTypeCounts).reduce((a, b) => flatTypeCounts[a] > flatTypeCounts[b] ? a : b);

    const transactions = properties.map((p) => ({
      id: p.id,
      month: p.month.toISOString().slice(0, 7),
      flat_type: p.flat_type,
      storey_range: p.storey_range,
      floor_area_sqm: p.floor_area_sqm,
      resale_price: p.resale_price,
      psf: p.psf,
      flat_model: p.flat_model,
      remaining_lease: p.remaining_lease
    }));

    const groupedByMonth = Object.entries(properties.reduce((acc, p) => {
      const month = p.month.toISOString().slice(0, 7);
      if (!acc[month]) acc[month] = [];
      acc[month].push(p);
      return acc;
    }, {} as Record<string, typeof properties>));

    const priceTrendData = groupedByMonth.sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => ({
      month,
      avgPrice: items.reduce((sum, item) => sum + item.resale_price, 0) / items.length
    }));

    const psfTrendData = groupedByMonth.sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => ({
      month,
      avgPsf: items.reduce((sum, item) => sum + item.psf, 0) / items.length
    }));

    const volumeByMonth = groupedByMonth.sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => ({
      month,
      transactions: items.length
    }));

    const avgPriceByFlatType = Object.entries(properties.reduce((acc, p) => {
      if (!acc[p.flat_type]) acc[p.flat_type] = { total: 0, count: 0 };
      acc[p.flat_type].total += p.resale_price;
      acc[p.flat_type].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)).map(([flat_type, data]) => ({
      flat_type,
      avgPrice: data.total / data.count
    }));

    const storeyRangeAvg = Object.entries(properties.reduce((acc, p) => {
      if (!acc[p.storey_range]) acc[p.storey_range] = { total: 0, count: 0 };
      acc[p.storey_range].total += p.resale_price;
      acc[p.storey_range].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)).map(([storey_range, data]) => ({
      storey_range,
      avgPrice: data.total / data.count
    }));

    const floorAreaScatter = properties.map((p) => ({
      floor_area_sqm: p.floor_area_sqm,
      resale_price: p.resale_price,
      psf: p.psf
    }));

    const priceDistributionBuckets = [
      { label: '< 300k', min: 0, max: 300000 },
      { label: '300k-450k', min: 300000, max: 450000 },
      { label: '450k-600k', min: 450000, max: 600000 },
      { label: '600k-750k', min: 600000, max: 750000 },
      { label: '> 750k', min: 750000, max: Infinity }
    ].map((bucket) => ({
      range: bucket.label,
      count: properties.filter((p) => p.resale_price >= bucket.min && p.resale_price < bucket.max).length
    }));

    const nearbyStreets = (await prisma.property.groupBy({
      by: ['street_name'],
      where: { town },
      _count: { _all: true },
      _avg: { resale_price: true }
    })).map((row) => ({
      street_name: row.street_name,
      avg_resale_price: row._avg.resale_price,
      total_transactions: row._count._all
    })).sort((a, b) => b.total_transactions - a.total_transactions).slice(0, 8);

    res.json({
      header,
      kpis: {
        avg_resale_price: avgPrice,
        avg_psf: avgPsf,
        total_transactions: properties.length,
        most_common_flat_type: mostCommonFlatType,
        highest_price: highestPrice,
        lowest_price: lowestPrice
      },
      charts: {
        priceTrend: priceTrendData,
        avgPriceByFlatType,
        storeyRangeAvg,
        floorAreaScatter,
        psfTrend: psfTrendData,
        volumeByMonth,
        priceDistribution: priceDistributionBuckets
      },
      transactions,
      nearby_streets: nearbyStreets
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get property details' });
  }
});

router.get('/:town/:street/:block/charts', async (req, res) => {
  try {
    const town = normalizeParam(req.params.town);
    const street = normalizeParam(req.params.street);
    const block = req.params.block;

    const properties = await prisma.property.findMany({
      where: { town, street_name: street, block },
      orderBy: { month: 'asc' }
    });

    const byMonth = Object.entries(properties.reduce((acc, p) => {
      const month = p.month.toISOString().slice(0, 7);
      if (!acc[month]) acc[month] = [];
      acc[month].push(p);
      return acc;
    }, {} as Record<string, typeof properties>)).sort(([a], [b]) => a.localeCompare(b));

    const priceTrend = byMonth.map(([month, items]) => ({
      month,
      avgPrice: items.reduce((sum, item) => sum + item.resale_price, 0) / items.length
    }));
    const psfTrend = byMonth.map(([month, items]) => ({
      month,
      avgPsf: items.reduce((sum, item) => sum + item.psf, 0) / items.length
    }));
    const volumeByMonth = byMonth.map(([month, items]) => ({
      month,
      transactions: items.length
    }));

    const avgPriceByFlatType = Object.entries(properties.reduce((acc, p) => {
      if (!acc[p.flat_type]) acc[p.flat_type] = { total: 0, count: 0 };
      acc[p.flat_type].total += p.resale_price;
      acc[p.flat_type].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)).map(([flat_type, data]) => ({
      flat_type,
      avgPrice: data.total / data.count
    }));

    const storeyRangeAvg = Object.entries(properties.reduce((acc, p) => {
      if (!acc[p.storey_range]) acc[p.storey_range] = { total: 0, count: 0 };
      acc[p.storey_range].total += p.resale_price;
      acc[p.storey_range].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>)).map(([storey_range, data]) => ({
      storey_range,
      avgPrice: data.total / data.count
    }));

    const priceDistribution = [
      { label: '< 300k', count: properties.filter((p) => p.resale_price < 300000).length },
      { label: '300k-450k', count: properties.filter((p) => p.resale_price >= 300000 && p.resale_price < 450000).length },
      { label: '450k-600k', count: properties.filter((p) => p.resale_price >= 450000 && p.resale_price < 600000).length },
      { label: '> 600k', count: properties.filter((p) => p.resale_price >= 600000).length }
    ];

    res.json({
      priceTrend,
      psfTrend,
      volumeByMonth,
      avgPriceByFlatType,
      storeyRangeAvg,
      priceDistribution
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

export default router;
