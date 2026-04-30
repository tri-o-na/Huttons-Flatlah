import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { formatCurrency } from '../utils/format';

interface TownOption {
  town: string;
}

interface ComparisonResult {
  town: string;
  avg_price: number;
  avg_psf: number;
  transaction_volume: number;
  top_flat_type: string;
  avg_lease_commence_date?: number;
  most_common_remaining_lease?: string;
  price_trend: Array<{ month: string; avg_price: number; count?: number }>;
  flat_type_mix?: Record<string, number>;
  calculations?: {
    avg_psf?: {
      count?: number;
      formula?: string;
      factors?: string[];
      sum_psf?: number;
    };
    avg_price?: {
      count?: number;
      formula?: string;
      factors?: string[];
      sum_price?: number;
    };
    price_trend?: {
      formula?: string;
      factors?: string[];
    };
  };
}

const TOWN_COLORS = ['#3B82F6', '#F97316', '#10B981', '#A855F7', '#EF4444'];

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  padding: '24px',
};

const Comparison = () => {
  useEffect(() => { document.title = 'FlatLah | Comparison'; }, []);
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    axios
      .get('http://localhost:3002/api/towns')
      .then((r) => setTownOptions(r.data))
      .catch(console.error);
  }, []);

  const filteredOptions = useMemo(
    () => townOptions.filter((o) => o.town.toLowerCase().includes(searchQuery.toLowerCase())),
    [townOptions, searchQuery]
  );

  const handleToggleTown = (town: string) => {
    setSelectedTowns((prev) =>
      prev.includes(town)
        ? prev.filter((t) => t !== town)
        : prev.length < 5
        ? [...prev, town]
        : prev
    );
  };

  const handleRemoveTown = (town: string) => {
    setSelectedTowns((prev) => prev.filter((t) => t !== town));
    setComparisonData((prev) => prev.filter((d) => d.town !== town));
  };

  const executeComparison = async () => {
    if (selectedTowns.length === 0) return;
    setLoading(true);
    try {
      const r = await axios.post('http://localhost:3002/api/comparison', { towns: selectedTowns });
      setComparisonData(r.data);
    } catch (e) {
      console.error('Comparison failed:', e);
    }
    setLoading(false);
  };

  const priceTrendData = useMemo(() => {
    const months = Array.from(
      new Set(comparisonData.flatMap((d) => d.price_trend.map((r) => r.month)))
    ).sort();
    return months.map((month) => {
      const row: Record<string, string | number> = { month };
      comparisonData.forEach((d) => {
        row[d.town] = d.price_trend.find((t) => t.month === month)?.avg_price ?? 0;
      });
      return row;
    });
  }, [comparisonData]);

  const psfBarData = useMemo(
    () =>
      comparisonData.map((d) => ({
        town: d.town,
        avg_psf: d.avg_psf,
        _calc: d.calculations?.avg_psf,
      })),
    [comparisonData]
  );

  const METRIC_ROWS = [
    { label: 'Avg Resale Price', key: 'avg_price', format: (v: any) => formatCurrency(v) },
    { label: 'Avg PSF', key: 'avg_psf', format: (v: any) => `SGD ${Number(v).toFixed(2)}` },
    { label: 'Transaction Volume', key: 'transaction_volume', format: (v: any) => Number(v).toLocaleString() },
    { label: 'Most Popular Type', key: 'top_flat_type', format: (v: any) => String(v) },
    { label: 'Avg Lease Start', key: 'avg_lease_commence_date', format: (v: any) => v ? String(Math.round(v)) : 'N/A' },
    { label: 'Common Remaining Lease', key: 'most_common_remaining_lease', format: (v: any) => v ?? 'N/A' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', padding: '24px 16px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
              Town Comparison
            </h1>
            <p style={{ color: '#94A3B8', margin: 0 }}>
              Pick up to 5 HDB towns to compare their resale market metrics.
            </p>
          </div>
          <Link
            to="/towns"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '8px',
              background: '#3B82F6', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              flexShrink: 0, boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
            }}
          >
            View more about specific towns →
          </Link>
        </div>

        {/* Selection Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
          {/* Town picker */}
          <div style={cardStyle}>
            <h2 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 14px' }}>
              Select towns (up to 5)
            </h2>
            {/* Search */}
            <input
              type="text"
              placeholder="Filter towns…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #3B82F6',
                background: '#EFF6FF',
                padding: '10px 14px',
                marginBottom: '10px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#1E3A8A',
              }}
            />
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredOptions.map((o) => {
                const selected = selectedTowns.includes(o.town);
                const disabled = !selected && selectedTowns.length >= 5;
                return (
                  <button
                    key={o.town}
                    onClick={() => !disabled && handleToggleTown(o.town)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${selected ? '#3B82F6' : '#E2E8F0'}`,
                      background: selected ? '#EFF6FF' : '#F8FAFC',
                      color: selected ? '#1D4ED8' : disabled ? '#CBD5E0' : '#1E293B',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: selected ? 600 : 400,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {o.town}
                  </button>
                );
              })}
            </div>
            <button
              onClick={executeComparison}
              disabled={selectedTowns.length === 0 || loading}
              style={{
                marginTop: '14px',
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: selectedTowns.length === 0 ? '#CBD5E0' : '#3B82F6',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: selectedTowns.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Comparing…' : 'Compare Selected Towns'}
            </button>
          </div>

          {/* Selected towns */}
          <div style={cardStyle}>
            <h2 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 14px' }}>
              Selected ({selectedTowns.length}/5)
            </h2>
            {selectedTowns.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Select up to 5 towns to compare.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedTowns.map((town, i) => (
                  <div
                    key={town}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `2px solid ${TOWN_COLORS[i % TOWN_COLORS.length]}`,
                      background: `${TOWN_COLORS[i % TOWN_COLORS.length]}10`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: TOWN_COLORS[i % TOWN_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600 }}>{town}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveTown(town)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94A3B8',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {comparisonData.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI Cards per town */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparisonData.length}, 1fr)`, gap: '16px' }}>
              {comparisonData.map((item, i) => (
                <div key={item.town} style={{ ...cardStyle, borderTop: `4px solid ${TOWN_COLORS[i % TOWN_COLORS.length]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ color: '#1E293B', fontSize: '18px', fontWeight: 700, margin: 0 }}>{item.town}</h3>
                    <button
                      onClick={() => handleRemoveTown(item.town)}
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'Avg Price', value: formatCurrency(item.avg_price) },
                      { label: 'Avg PSF', value: `SGD ${item.avg_psf.toFixed(0)}` },
                      { label: 'Transactions', value: item.transaction_volume.toLocaleString() },
                      { label: 'Top Type', value: item.top_flat_type },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px' }}>
                        <p style={{ color: '#64748B', fontSize: '11px', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ color: '#1E293B', fontSize: '14px', fontWeight: 700, margin: 0 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Trend Chart */}
            <div style={cardStyle}>
              <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                Price Trend Comparison
              </h3>
              <div style={{ height: '360px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} interval={11} />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      content={({ active, label, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const month = String(label ?? '');

                        return (
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              minWidth: '260px',
                            }}
                          >
                            <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                              {month}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {payload
                                .filter((p) => p.dataKey !== 'month')
                                .map((p, idx) => {
                                  const town = String(p.dataKey);
                                  const townData = comparisonData.find((d) => d.town === town);
                                  const point = townData?.price_trend.find((t) => t.month === month);
                                  const count = point?.count;

                                  return (
                                    <div key={`${town}-${idx}`}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: '#1E293B', fontWeight: 700, fontSize: '12px' }}>{town}</span>
                                        <span style={{ color: '#1E293B', fontWeight: 700, fontSize: '12px' }}>
                                          {formatCurrency(Number(p.value))}
                                        </span>
                                      </div>
                                      <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>
                                        {townData?.calculations?.price_trend?.formula ??
                                          'monthly avg_price = (sum of resale_price in month) / (number of transactions in month)'}
                                        {typeof count === 'number' ? ` | n=${count}` : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    {comparisonData.map((item, i) => (
                      <Line
                        key={item.town}
                        type="monotone"
                        dataKey={item.town}
                        stroke={TOWN_COLORS[i % TOWN_COLORS.length]}
                        strokeWidth={2.5}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PSF Side-by-Side Bar Chart */}
            <div style={cardStyle}>
              <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                Avg PSF Comparison
              </h3>
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={psfBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="town" tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any) => `SGD ${Number(v).toFixed(2)}`}
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const p0 = payload[0];
                        const town = String((p0.payload as any)?.town ?? '');
                        const calc =
                          ((p0.payload as any)?._calc as any) ??
                          (comparisonData.find((d) => d.town === town)?.calculations?.avg_psf as any);

                        const avgPsf = Number((p0.payload as any)?.avg_psf ?? 0);
                        const count =
                          calc?.count ??
                          (p0.payload as any)?.transaction_volume ??
                          comparisonData.find((d) => d.town === town)?.transaction_volume;
                        const sumPsf = calc?.sum_psf;
                        const formula = calc?.formula ?? 'avg_psf = (sum of transaction psf) / (number of transactions)';
                        const factors = calc?.factors ?? ['town', 'all available transactions in dataset for that town'];

                        return (
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              minWidth: '280px',
                            }}
                          >
                            <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                              {town}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ color: '#64748B', fontSize: '12px' }}>Avg PSF</span>
                              <span style={{ color: '#1E293B', fontWeight: 800, fontSize: '12px' }}>SGD {avgPsf.toFixed(2)}</span>
                            </div>
                            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '6px' }}>{formula}</div>
                            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '6px' }}>
                              Factors: {factors.join(', ')}
                            </div>
                            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '6px' }}>
                              {typeof count === 'number' ? `Transactions used (n): ${count}` : 'Transactions used (n): N/A'}
                              {typeof sumPsf === 'number' ? ` | Sum PSF: ${sumPsf.toFixed(2)}` : ''}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="avg_psf" radius={[6, 6, 0, 0]}>
                      {psfBarData.map((_, i) => (
                        <Cell key={i} fill={TOWN_COLORS[i % TOWN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Full Metrics Table */}
            <div style={cardStyle}>
              <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>
                Full Metrics Comparison
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#1B2B5E' }}>
                      <th style={{ color: '#FFFFFF', padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>
                        Metric
                      </th>
                      {comparisonData.map((d, i) => (
                        <th
                          key={d.town}
                          style={{
                            color: '#FFFFFF',
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontWeight: 600,
                            borderLeft: `3px solid ${TOWN_COLORS[i % TOWN_COLORS.length]}`,
                          }}
                        >
                          {d.town}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_ROWS.map((row, ri) => (
                      <tr key={row.label} style={{ background: ri % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                        <td style={{ padding: '11px 16px', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>
                          {row.label}
                        </td>
                        {comparisonData.map((d) => (
                          <td key={d.town} style={{ padding: '11px 16px', color: '#1E293B', fontWeight: 600 }}>
                            {row.format((d as any)[row.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Comparison;