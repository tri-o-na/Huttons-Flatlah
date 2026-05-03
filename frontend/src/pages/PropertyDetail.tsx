import React, { useEffect, useState, useMemo, useCallback } from 'react';

import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../utils/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, Legend, CartesianGrid, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { formatCurrency, formatPsf } from '../utils/format';
import 'leaflet/dist/leaflet.css';

/* ─── Types ─── */
interface Transaction {
  id: number; month: string; flat_type: string; storey_range: string;
  floor_area_sqm: number; resale_price: number; psf: number;
  flat_model: string; remaining_lease: string;
}
interface PropertyDetailResponse {
  header: {
    block: string; street_name: string; town: string;
    flat_model: string; lease_commence_date: number; remaining_lease: string;
  };
  kpis: {
    avg_resale_price: number; avg_psf: number; total_transactions: number;
    most_common_flat_type: string; highest_price: number; lowest_price: number;
  };
  charts: {
    priceTrend: Array<{ month: string; avgPrice: number }>;
    psfTrend: Array<{ month: string; avgPsf: number }>;
    volumeByMonth: Array<{ month: string; transactions: number }>;
    avgPriceByFlatType: Array<{ flat_type: string; avgPrice: number }>;
    storeyRangeAvg: Array<{ storey_range: string; avgPrice: number }>;
    floorAreaScatter?: Array<{ floor_area_sqm: number; resale_price: number }>;
    priceDistribution: Array<{ range: string; count: number }>;
  };
  transactions: Transaction[];
  nearby_streets: Array<{ street_name: string; avg_resale_price: number; total_transactions: number }>;
}

type TabId = 'general' | 'charts' | 'nearby' | 'amenities' | 'transactions';

interface Amenity {
  kind: 'school' | 'mrt' | 'bus' | 'park';
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
}
interface NearbyAmenities {
  schools: Amenity[];
  mrt: Amenity[];
  bus: Amenity[];
  parks: Amenity[];
  radius_m: number;
}
const AMENITY_META: Record<Amenity['kind'], { emoji: string; bg: string; label: string }> = {
  school: { emoji: '🏫', bg: '#F59E0B', label: 'School' },
  mrt: { emoji: '🚇', bg: '#0EA5E9', label: 'MRT' },
  bus: { emoji: '🚌', bg: '#10B981', label: 'Bus Stop' },
  park: { emoji: '🌳', bg: '#22C55E', label: 'Park' },
};
type SortKey = keyof Transaction;
type SortDir = 'asc' | 'desc';

/* ─── Constants ─── */
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'charts', label: 'Sales Charts' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'nearby', label: 'Nearby Streets' },
  { id: 'transactions', label: 'Transactions' },
];
const COLORS = ['#3B82F6', '#C9A84C', '#10B981', '#8B5CF6', '#E11D48'];
const TABLE_PAGE_SIZE = 15;

/* ─── Geocache ─── */
const GEO_KEY = 'hdb_geocache';
function getGeoCache(): Record<string, [number, number]> {
  try { return JSON.parse(localStorage.getItem(GEO_KEY) || '{}'); } catch { return {}; }
}
function setGeoCache(k: string, v: [number, number]) {
  try { const c = getGeoCache(); c[k] = v; localStorage.setItem(GEO_KEY, JSON.stringify(c)); } catch {}
}

/* ─── Leaflet icon ─── */
function createPropertyIcon() {
  return L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
    </div>`,
    className: '', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14],
  });
}

/* ─── Shared card style ─── */
const card: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: '12px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden',
};

/* ═══════════════════════════════
   TAB: GENERAL
═══════════════════════════════ */
const GeneralTab = ({ data }: { data: PropertyDetailResponse }) => {
  // Compute simple annualised return from price trend
  const annReturn = useMemo(() => {
    const t = data.charts.priceTrend;
    if (t.length < 6) return null;
    const first = t[0].avgPrice;
    const last = t[t.length - 1].avgPrice;
    const years = t.length / 12;
    return ((Math.pow(last / first, 1 / years) - 1) * 100).toFixed(1);
  }, [data]);

  const fields = [
    { label: 'Street', value: data.header.street_name },
    { label: 'Block', value: data.header.block },
    { label: 'Town', value: data.header.town },
    { label: 'Property Type', value: 'HDB' },
    { label: 'Flat Model', value: data.header.flat_model },
    { label: 'Most Common Type', value: data.kpis.most_common_flat_type },
    { label: 'Lease Commenced', value: String(data.header.lease_commence_date) },
    { label: 'Remaining Lease', value: data.header.remaining_lease },
  ];

  const marketFields = [
    { label: 'Avg Resale Price', value: formatCurrency(data.kpis.avg_resale_price) },
    { label: 'Avg PSF', value: formatPsf(data.kpis.avg_psf) },
    { label: 'Highest Price', value: formatCurrency(data.kpis.highest_price) },
    { label: 'Lowest Price', value: formatCurrency(data.kpis.lowest_price) },
    { label: 'Total Transactions', value: String(data.kpis.total_transactions) },
    { label: 'Annualised Return', value: annReturn ? `${Number(annReturn) > 0 ? '+' : ''}${annReturn}% p.a.` : 'N/A' },
  ];

  const FieldRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', padding: '11px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ width: '160px', flexShrink: 0, color: '#64748B', fontSize: '13px' }}>{label}</span>
      <span style={{ color: '#1E293B', fontSize: '13px', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* General section */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600, margin: 0 }}>General</h3>
        </div>
        <div style={{ padding: '4px 20px 8px' }}>
          {fields.map((f) => <FieldRow key={f.label} {...f} />)}
        </div>
      </div>

      {/* Market performance section */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h3 style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600, margin: 0 }}>Market Performance</h3>
        </div>
        <div style={{ padding: '4px 20px 8px' }}>
          {marketFields.map((f) => (
            <div key={f.label} style={{ display: 'flex', padding: '11px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ width: '160px', flexShrink: 0, color: '#64748B', fontSize: '13px' }}>{f.label}</span>
              <span style={{
                fontSize: '13px', fontWeight: 600,
                color: f.label === 'Annualised Return'
                  ? (f.value.startsWith('+') ? '#16a34a' : f.value === 'N/A' ? '#94A3B8' : '#dc2626')
                  : '#1E293B',
              }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════
   TAB: SALES CHARTS
═══════════════════════════════ */
const ChartsTab = ({ data }: { data: PropertyDetailResponse }) => {
  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ ...card, padding: '16px 18px' }}>
      <h4 style={{ color: '#1E293B', fontSize: '13px', fontWeight: 600, margin: '0 0 14px' }}>{title}</h4>
      <div style={{ height: '200px' }}>{children}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      <ChartCard title="Resale Price Trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.charts.priceTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 9 }} interval={11} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={40} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Avg Price']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="avgPrice" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="PSF Trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.charts.psfTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 9 }} interval={11} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} width={38} />
            <Tooltip formatter={(v) => [`SGD ${Number(v ?? 0).toFixed(0)}`, 'Avg PSF']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="avgPsf" stroke="#10B981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Transaction Volume">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.charts.volumeByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 9 }} interval={11} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} width={28} />
            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Bar dataKey="transactions" fill="#F97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Avg Price by Flat Type">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.charts.avgPriceByFlatType}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="flat_type" tick={{ fill: '#94A3B8', fontSize: 9 }} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={40} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Avg Price']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Bar dataKey="avgPrice" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Storey vs Avg Price">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.charts.storeyRangeAvg}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="storey_range" tick={{ fill: '#94A3B8', fontSize: 8 }} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={40} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Avg Price']} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Bar dataKey="avgPrice" fill="#C9A84C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Price Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.charts.priceDistribution} dataKey="count" nameKey="range" outerRadius={75}
              label={(props: any) => props.range ?? ''} labelLine={false}>
              {data.charts.priceDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {data.charts.floorAreaScatter && data.charts.floorAreaScatter.length > 0 && (
        <div style={{ ...card, padding: '16px 18px', gridColumn: '1 / -1' }}>
          <h4 style={{ color: '#1E293B', fontSize: '13px', fontWeight: 600, margin: '0 0 14px' }}>Floor Area vs Resale Price</h4>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="floor_area_sqm" name="Area" unit=" sqm" tick={{ fill: '#94A3B8', fontSize: 9 }} />
                <YAxis dataKey="resale_price" name="Price" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: '#94A3B8', fontSize: 9 }} width={44} />
                <ZAxis range={[25, 25]} />
                <Tooltip
                  formatter={(v: any, name) => [name === 'Price' ? formatCurrency(Number(v)) : `${v} sqm`, String(name ?? '')]}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                />
                <Scatter data={data.charts.floorAreaScatter} fill="#3B82F6" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════
   TAB: AMENITIES (schools, MRT, bus, parks within 1.5km)
═══════════════════════════════ */
const AmenitiesTab = ({
  amenities,
  loading,
}: {
  amenities: NearbyAmenities | null;
  loading: boolean;
}) => {
  const [expandedKind, setExpandedKind] = useState<Amenity['kind'] | null>('school');

  if (loading && !amenities) {
    return <p style={{ color: '#64748B', fontSize: '14px' }}>Loading nearby amenities...</p>;
  }
  if (!amenities) {
    return <p style={{ color: '#64748B', fontSize: '14px' }}>Amenity data unavailable.</p>;
  }
  const sections: Array<{ kind: Amenity['kind']; items: Amenity[] }> = [
    { kind: 'school', items: amenities.schools },
    { kind: 'mrt', items: amenities.mrt },
    { kind: 'bus', items: amenities.bus },
    { kind: 'park', items: amenities.parks },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>
        Within {amenities.radius_m} m of this block
      </p>
      {sections.map(({ kind, items }) => {
        const meta = AMENITY_META[kind];
        const isOpen = expandedKind === kind;
        return (
          <div key={kind} style={{ ...card, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setExpandedKind(isOpen ? null : kind)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0,
              }}>{meta.emoji}</div>
              <h3 style={{ color: '#1B2B5E', fontSize: '15px', fontWeight: 600, margin: 0, flex: 1 }}>
                {meta.label}s
              </h3>
              <span style={{ color: '#64748B', fontSize: '13px', fontWeight: 600 }}>{items.length}</span>
              <span style={{
                color: '#64748B', fontSize: '14px',
                transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
              }}>▾</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 16px 14px' }}>
                {items.length === 0 ? (
                  <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>None within {amenities.radius_m} m</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none',
                      }}>
                        <span style={{ color: '#0F172A', fontSize: '13px', flex: 1, marginRight: '12px' }}>{a.name}</span>
                        <span style={{ color: '#3B82F6', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>{a.distance_m} m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════
   TAB: NEARBY STREETS
═══════════════════════════════ */
const NearbyTab = ({ data }: { data: PropertyDetailResponse }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    {data.nearby_streets.map((s) => (
      <Link
        key={s.street_name}
        to={`/?town=${encodeURIComponent(data.header.town)}&q=${encodeURIComponent(s.street_name)}`}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', background: '#FFFFFF', borderRadius: '10px',
          border: '1px solid #E2E8F0', textDecoration: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3B82F6')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
      >
        <div>
          <p style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600, margin: '0 0 3px' }}>{s.street_name}</p>
          <p style={{ color: '#64748B', fontSize: '12px', margin: 0 }}>{s.total_transactions} transactions</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{formatCurrency(s.avg_resale_price)}</p>
          <p style={{ color: '#94A3B8', fontSize: '11px', margin: 0 }}>avg price</p>
        </div>
      </Link>
    ))}
  </div>
);

/* ═══════════════════════════════
   TAB: TRANSACTIONS
═══════════════════════════════ */
const TransactionsTab = ({
  filteredTx, tablePage, setTablePage, totalTablePages,
  tableSearch, setTableSearch, sortKey, sortDir, handleSort, exportCsv,
}: {
  filteredTx: Transaction[]; tablePage: number; setTablePage: (p: number) => void;
  totalTablePages: number; tableSearch: string; setTableSearch: (s: string) => void;
  sortKey: SortKey; sortDir: SortDir; handleSort: (k: SortKey) => void; exportCsv: () => void;
}) => {
  const pagedTx = filteredTx.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);
  const COLS: Array<{ key: SortKey; label: string }> = [
    { key: 'month', label: 'Month' }, { key: 'flat_type', label: 'Type' },
    { key: 'storey_range', label: 'Storey' }, { key: 'floor_area_sqm', label: 'Area (sqm)' },
    { key: 'resale_price', label: 'Price' }, { key: 'psf', label: 'PSF' },
    { key: 'flat_model', label: 'Model' }, { key: 'remaining_lease', label: 'Lease Left' },
  ];

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      }}>
        <p style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          Transactions
          <span style={{ color: '#64748B', fontWeight: 400, marginLeft: '6px', fontSize: '13px' }}>({filteredTx.length})</span>
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Filter…" value={tableSearch}
            onChange={(e) => { setTableSearch(e.target.value); setTablePage(1); }}
            style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #CBD5E0', fontSize: '12px', outline: 'none', width: '140px' }} />
          <button onClick={exportCsv}
            style={{ padding: '6px 14px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#1B2B5E' }}>
              {COLS.map(({ key, label }) => (
                <th key={key} onClick={() => handleSort(key)}
                  style={{ color: '#FFFFFF', padding: '10px 13px', textAlign: 'left', fontWeight: 600, fontSize: '11px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {label}
                  <span style={{ marginLeft: '3px', opacity: sortKey === key ? 1 : 0.35 }}>
                    {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedTx.map((tx, i) => (
              <tr key={tx.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                <td style={{ padding: '9px 13px', color: '#1E293B', fontWeight: 500 }}>{tx.month}</td>
                <td style={{ padding: '9px 13px', color: '#1E293B' }}>{tx.flat_type}</td>
                <td style={{ padding: '9px 13px', color: '#64748B' }}>{tx.storey_range}</td>
                <td style={{ padding: '9px 13px', color: '#64748B' }}>{tx.floor_area_sqm}</td>
                <td style={{ padding: '9px 13px', color: '#1E293B', fontWeight: 600 }}>{formatCurrency(tx.resale_price)}</td>
                <td style={{ padding: '9px 13px', color: '#64748B' }}>SGD {tx.psf.toFixed(0)}</td>
                <td style={{ padding: '9px 13px', color: '#64748B' }}>{tx.flat_model}</td>
                <td style={{ padding: '9px 13px', color: '#64748B' }}>{tx.remaining_lease}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalTablePages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748B', fontSize: '12px' }}>Page {tablePage} of {totalTablePages}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['Prev', 'Next'].map((label, di) => {
              const disabled = di === 0 ? tablePage === 1 : tablePage === totalTablePages;
              return (
                <button key={label} disabled={disabled}
                  onClick={() => setTablePage(tablePage + (di === 0 ? -1 : 1))}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #CBD5E0', background: disabled ? '#F1F5F9' : '#FFFFFF', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', color: disabled ? '#94A3B8' : '#1E293B' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════
   MAIN COMPONENT
═══════════════════════════════ */
const PropertyDetail = () => {
  const params = useParams();
  const [data, setData] = useState<PropertyDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [amenities, setAmenities] = useState<NearbyAmenities | null>(null);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Transaction table state
  const [tablePage, setTablePage] = useState(1);
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('month');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (data) {
      document.title = `FlatLah | Blk ${data.header.block} ${data.header.street_name}`;
    } else {
      document.title = 'FlatLah | Property';
    }
  }, [data]);

  useEffect(() => {
    if (!params.town || !params.street || !params.block) return;
    setLoading(true);
    const fetch = async () => {
      try {
        const r = await axios.get(
          `${API_BASE}/api/properties/${params.town}/${params.street}/${params.block}`
        );
        setData(r.data);
        const address = `${r.data.header.block} ${r.data.header.street_name} Singapore`;
        const cacheKey = address.toLowerCase();
        const cached = getGeoCache();
        if (cached[cacheKey]) {
          setCoordinates(cached[cacheKey]);
        } else {
          const geo = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
          );
          if (geo.data.length > 0) {
            const coords: [number, number] = [parseFloat(geo.data[0].lat), parseFloat(geo.data[0].lon)];
            setCoordinates(coords);
            setGeoCache(cacheKey, coords);
          }
        }
      } catch { setError('Property details could not be loaded.'); }
      setLoading(false);
    };
    fetch();
  }, [params.town, params.street, params.block]);

  // Fetch nearby amenities once we have coordinates
  useEffect(() => {
    if (!coordinates) return;
    let cancelled = false;
    setLoadingAmenities(true);
    axios
      .get(`${API_BASE}/api/amenities/nearby`, {
        params: { lat: coordinates[0], lng: coordinates[1], radius: 1500 },
      })
      .then((r) => { if (!cancelled) setAmenities(r.data); })
      .catch((e) => { if (!cancelled) console.error('Amenities fetch failed', e); })
      .finally(() => { if (!cancelled) setLoadingAmenities(false); });
    return () => { cancelled = true; };
  }, [coordinates]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => { if (prev === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); return key; });
    setTablePage(1);
  }, []);

  const filteredTx = useMemo(() => {
    if (!data) return [];
    const q = tableSearch.toLowerCase();
    const base = q ? data.transactions.filter((tx) =>
      tx.flat_type.toLowerCase().includes(q) || tx.storey_range.toLowerCase().includes(q) ||
      tx.month.includes(q) || tx.flat_model.toLowerCase().includes(q)
    ) : data.transactions;
    return [...base].sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [data, tableSearch, sortKey, sortDir]);

  const totalTablePages = Math.ceil(filteredTx.length / TABLE_PAGE_SIZE);

  const exportCsv = () => {
    if (!data) return;
    const hdr = ['Month','Type','Storey','Area(sqm)','Price','PSF','Model','Lease Left'];
    const rows = filteredTx.map((tx) => [tx.month,tx.flat_type,tx.storey_range,tx.floor_area_sqm,tx.resale_price,tx.psf.toFixed(2),tx.flat_model,tx.remaining_lease]);
    const csv = [hdr, ...rows].map((r) => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${data.header.block}-transactions.csv`; a.click();
  };

  /* ── Loading / error states ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94A3B8', fontSize: '16px' }}>Loading property details…</p>
    </div>
  );
  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', padding: '24px' }}>
      <div style={{ ...card, padding: '32px', color: '#64748B' }}>{error || 'Property not found.'}</div>
    </div>
  );

  const googleMapsUrl = coordinates
    ? `https://www.google.com/maps?q=${coordinates[0]},${coordinates[1]}`
    : `https://www.google.com/maps/search/${encodeURIComponent(`${data.header.block} ${data.header.street_name} Singapore`)}`;

  /* ── Layout ── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40% 1fr', height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#0A1628' }}>

      {/* ── LEFT: Map + info card ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {coordinates ? (
            <MapContainer center={coordinates} zoom={17} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors' />
              <Marker position={coordinates} icon={createPropertyIcon()}>
                <Popup><strong>{data.header.block} {data.header.street_name}</strong><br />{data.header.town}</Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div style={{ height: '100%', background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#64748B', fontSize: '14px' }}>Loading map…</p>
            </div>
          )}
        </div>

        {/* Info card below map */}
        <div style={{ background: '#0D1F3C', padding: '16px 20px', borderTop: '1px solid #1E3A5F', flexShrink: 0 }}>
          <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, margin: '0 0 2px' }}>
            {data.header.block} {data.header.street_name}
          </p>
          <p style={{ color: '#64748B', fontSize: '12px', margin: '0 0 10px' }}>
            {data.header.town} · {data.header.flat_model} · Lease from {data.header.lease_commence_date}
          </p>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 13px', background: '#1E3A5F', color: '#94A3B8',
              borderRadius: '7px', fontSize: '12px', fontWeight: 500, textDecoration: 'none',
              border: '1px solid #334155',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            Open in Google Maps
          </a>
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F1F5F9' }}>

        {/* Sticky header (dark navy) */}
        <div style={{ background: '#1B2B5E', flexShrink: 0, padding: '14px 20px 0' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px' }}>
            <Link to="/search" style={{ color: '#64A3E8', textDecoration: 'none' }}>Search</Link>
            <span style={{ color: '#475569' }}>›</span>
            <Link to={`/towns?town=${encodeURIComponent(data.header.town)}`} style={{ color: '#64A3E8', textDecoration: 'none' }}>
              {data.header.town}
            </Link>
            <span style={{ color: '#475569' }}>›</span>
            <span style={{ color: '#94A3B8' }}>{data.header.block} {data.header.street_name}</span>
          </div>

          {/* Block title */}
          <h1 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, margin: '0 0 2px', lineHeight: 1.3 }}>
            BLK {data.header.block} — {data.header.street_name}
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: '0 0 14px' }}>
            {data.header.town} · HDB · {data.header.flat_model}
          </p>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'Avg Price', value: formatCurrency(data.kpis.avg_resale_price), accent: true },
              { label: 'Avg PSF', value: formatPsf(data.kpis.avg_psf) },
              { label: 'Transactions', value: String(data.kpis.total_transactions) },
              { label: 'Highest', value: formatCurrency(data.kpis.highest_price) },
              { label: 'Lowest', value: formatCurrency(data.kpis.lowest_price) },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: accent ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${accent ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '8px', padding: '7px 12px',
              }}>
                <p style={{ color: '#94A3B8', fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
                <p style={{ color: accent ? '#93C5FD' : '#FFFFFF', fontSize: '12px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 16px', background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : '#64748B',
                  fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 32px' }}>
          {activeTab === 'general' && <GeneralTab data={data} />}
          {activeTab === 'charts' && <ChartsTab data={data} />}
          {activeTab === 'nearby' && <NearbyTab data={data} />}
          {activeTab === 'amenities' && (
            <AmenitiesTab amenities={amenities} loading={loadingAmenities} />
          )}
          {activeTab === 'transactions' && (
            <TransactionsTab
              filteredTx={filteredTx} tablePage={tablePage} setTablePage={setTablePage}
              totalTablePages={totalTablePages} tableSearch={tableSearch} setTableSearch={setTableSearch}
              sortKey={sortKey} sortDir={sortDir} handleSort={handleSort} exportCsv={exportCsv}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;