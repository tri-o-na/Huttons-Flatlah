import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../utils/api';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatCurrency } from '../utils/format';

interface TownOption {
  town: string;
}

interface TownAnalyticsData {
  kpis: {
    total_transactions: number;
    avg_price: number;
    avg_psf: number;
    most_transacted_flat_type: string;
  };
  charts: {
    priceTrendByFlatType: Array<{
      flat_type: string;
      data: Array<{ month: string; avg_price: number }>;
    }>;
    transactionByYear: Array<{ year: number; count: number }>;
    flatTypeShare: Array<{ flat_type: string; count: number; share: number }>;
    topStreets: Array<{
      street_name: string;
      transactions: number;
      avg_price: number;
    }>;
    avgPsfByFlatType: Array<{ flat_type: string; avg_psf: number }>;
    yoyChange: Array<{
      flat_type: string;
      current_year: number;
      prior_year: number | null;
      change_pct: number | null;
    }>;
  };
}

const COLORS = ['#3B82F6', '#C9A84C', '#10B981', '#8B5CF6', '#E11D48'];

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
  padding: '24px',
};

const TownAnalytics = () => {
  const [searchParams] = useSearchParams();
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [selectedTown, setSelectedTown] = useState('');
  useEffect(() => { document.title = selectedTown ? `FlatLah | ${selectedTown}` : 'FlatLah | Town Analytics'; }, [selectedTown]);
  const [analytics, setAnalytics] = useState<TownAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Support pre-selection via URL query param (e.g. from Map sidebar)
  useEffect(() => {
    const fromUrl = searchParams.get('town');
    if (fromUrl) setSelectedTown(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/towns`)
      .then((r) => setTownOptions(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedTown) return;
    setLoading(true);
    axios
      .get(`${API_BASE}/api/towns/${encodeURIComponent(selectedTown)}`)
      .then((r) => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedTown]);

  // Compute YoY change for the most transacted flat type (for KPI card)
  const yoyKpi = analytics?.charts.yoyChange.find(
    (c) => c.flat_type === analytics.kpis.most_transacted_flat_type
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', padding: '24px 16px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
              Town Analytics
            </h1>
            <p style={{ color: '#94A3B8', margin: 0 }}>
              Comprehensive market analysis for HDB towns in Singapore.
            </p>
          </div>
          <Link
            to="/comparison"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '8px',
              background: '#3B82F6', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              flexShrink: 0, boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
            }}
          >
            Compare different towns here →
          </Link>
        </div>

        {/* Town Selector */}
        <div style={{ marginBottom: '32px' }}>
          <select
            value={selectedTown}
            onChange={(e) => setSelectedTown(e.target.value)}
            style={{
              maxWidth: '380px',
              width: '100%',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: '#0D1F3C',
              padding: '12px 16px',
              color: '#FFFFFF',
              fontSize: '15px',
              outline: 'none',
            }}
          >
            <option value="">Select a town…</option>
            {townOptions.map((o) => (
              <option key={o.town} value={o.town}>
                {o.town}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#64748B', padding: '48px' }}>
            Loading analytics…
          </div>
        )}

        {analytics && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { label: 'Total Transactions', value: analytics.kpis.total_transactions.toLocaleString() },
                { label: 'Average Price', value: formatCurrency(analytics.kpis.avg_price) },
                { label: 'Average PSF', value: `SGD ${analytics.kpis.avg_psf.toFixed(2)}` },
                { label: 'Most Popular Type', value: analytics.kpis.most_transacted_flat_type },
                {
                  label: 'Price Change YoY',
                  value:
                    yoyKpi?.change_pct != null
                      ? `${yoyKpi.change_pct > 0 ? '+' : ''}${yoyKpi.change_pct.toFixed(1)}%`
                      : 'N/A',
                  valueColor:
                    yoyKpi?.change_pct && yoyKpi.change_pct > 0
                      ? '#16a34a'
                      : yoyKpi?.change_pct && yoyKpi.change_pct < 0
                      ? '#dc2626'
                      : '#64748B',
                },
              ].map(({ label, value, valueColor }) => (
                <div key={label} style={cardStyle}>
                  <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 8px' }}>{label}</p>
                  <p
                    style={{
                      color: valueColor || '#1E293B',
                      fontSize: '24px',
                      fontWeight: 700,
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(540px, 1fr))', gap: '20px' }}>
              {/* Price Trends by Flat Type */}
              <div style={cardStyle}>
                <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                  Price Trends by Flat Type
                </h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Legend />
                      {analytics.charts.priceTrendByFlatType.map((trend, index) => (
                        <Line
                          key={trend.flat_type}
                          type="monotone"
                          dataKey="avg_price"
                          data={trend.data}
                          name={trend.flat_type}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transactions by Year */}
              <div style={cardStyle}>
                <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                  Transactions by Year
                </h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.charts.transactionByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="year" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Flat Type Distribution */}
              <div style={cardStyle}>
                <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                  Flat Type Distribution
                </h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.charts.flatTypeShare}
                        dataKey="count"
                        nameKey="flat_type"
                        outerRadius={100}
                        label={(props: any) => `${props.flat_type ?? ''}: ${props.share ?? ''}%`}
                        labelLine={false}
                      >
                        {analytics.charts.flatTypeShare.map((entry, index) => (
                          <Cell key={entry.flat_type} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Avg PSF by Flat Type */}
              <div style={cardStyle}>
                <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                  Avg PSF by Flat Type
                </h3>
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.charts.avgPsfByFlatType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="flat_type" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `SGD ${Number(v).toFixed(2)}`} />
                      <Bar dataKey="avg_psf" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Streets (horizontal bar) */}
            <div style={cardStyle}>
              <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 20px' }}>
                Top 10 Most Transacted Streets
              </h3>
              <div style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.charts.topStreets.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis
                      dataKey="street_name"
                      type="category"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      width={160}
                    />
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Transactions']} />
                    <Bar dataKey="transactions" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* YoY Change Table */}
            <div style={cardStyle}>
              <h3 style={{ color: '#1E293B', fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>
                Year-over-Year Price Change by Flat Type
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#1B2B5E' }}>
                      {['Flat Type', 'Current Year', 'Prior Year', 'Change'].map((h) => (
                        <th
                          key={h}
                          style={{
                            color: '#FFFFFF',
                            padding: '10px 16px',
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: '13px',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.charts.yoyChange.map((row, i) => (
                      <tr key={row.flat_type} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                        <td style={{ padding: '10px 16px', color: '#1E293B', fontWeight: 500 }}>{row.flat_type}</td>
                        <td style={{ padding: '10px 16px', color: '#1E293B' }}>{row.current_year}</td>
                        <td style={{ padding: '10px 16px', color: '#64748B' }}>{row.prior_year ?? 'N/A'}</td>
                        <td
                          style={{
                            padding: '10px 16px',
                            fontWeight: 700,
                            color:
                              row.change_pct && row.change_pct > 0
                                ? '#16a34a'
                                : row.change_pct && row.change_pct < 0
                                ? '#dc2626'
                                : '#64748B',
                          }}
                        >
                          {row.change_pct != null
                            ? `${row.change_pct > 0 ? '+' : ''}${row.change_pct.toFixed(1)}%`
                            : 'N/A'}
                        </td>
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

export default TownAnalytics;