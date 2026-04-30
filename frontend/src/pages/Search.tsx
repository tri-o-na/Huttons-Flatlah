import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../utils/format';
import { buildPropertiesSearchParams } from '../utils/search';

interface PropertyCard {
  town: string;
  street_name: string;
  block: string;
  avg_resale_price: number;
  avg_psf: number;
  total_transactions: number;
}

interface TownOption {
  town: string;
}

const FLAT_TYPES = ['2 ROOM', '3 ROOM', '4 ROOM', '5 ROOM', 'EXECUTIVE'];
const STOREY_RANGES = [
  '01 TO 03','04 TO 06','07 TO 09','10 TO 12',
  '13 TO 15','16 TO 18','19 TO 21','22 TO 24',
  '25 TO 27','28 TO 30','31 TO 33','34 TO 36',
];

const GRADIENT_COLORS = [
  ['#3B82F6', '#1D4ED8'],
  ['#8B5CF6', '#6D28D9'],
  ['#EC4899', '#BE185D'],
  ['#14B8A6', '#0F766E'],
  ['#F97316', '#C2410C'],
  ['#C9A84C', '#92400E'],
];

function buildPath(town: string, street: string, block: string) {
  return `/property/${encodeURIComponent(town.replace(/\s+/g, '-'))}/${encodeURIComponent(street.replace(/\s+/g, '-'))}/${encodeURIComponent(block.replace(/\s+/g, '-'))}`;
}

const Search = () => {
  useEffect(() => { document.title = 'FlatLah | Search'; }, []);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    flatType: '',
    town: '',
    minPrice: '',
    maxPrice: '',
    storeyRange: '',
  });
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [priceStats, setPriceStats] = useState<{ minPrice: number; maxPrice: number } | null>(null);

  // Apply URL query params on mount (supports deep linking from Map sidebar and landing page)
  useEffect(() => {
    const q = searchParams.get('q');
    const town = searchParams.get('town');
    if (q) setSearch(q);
    if (town) setFilters((f) => ({ ...f, town }));
  }, []);

  useEffect(() => {
    axios.get('http://localhost:3002/api/towns').then((r) => setTownOptions(r.data)).catch(console.error);
    axios.get('http://localhost:3002/api/properties/stats').then((r) => setPriceStats(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    const params = buildPropertiesSearchParams({
      q: search,
      flatType: filters.flatType,
      town: filters.town,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      storeyRange: filters.storeyRange,
      sortBy,
      page: currentPage,
      limit: itemsPerPage,
    });

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      axios
        .get(`http://localhost:3002/api/properties/search?${params}`, { signal: controller.signal })
        .then((r) => {
          setProperties(r.data.data);
          setTotal(r.data.total);
          setTotalPages(r.data.totalPages);
        })
        .catch((err) => {
          if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error(err);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, filters, sortBy, currentPage, itemsPerPage]);

  const handleFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setCurrentPage(1);
  };

  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ color: '#0F172A', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
            HDB Resale Property Search
          </h1>
          <p style={{ color: '#475569', margin: 0 }}>
            Find your next HDB home with comprehensive market data and analytics.
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by town, street, block or flat type…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              padding: '14px 16px 14px 48px',
              color: '#0F172A',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          />
          <svg
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}
            width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            {
              key: 'town',
              el: (
                <select value={filters.town} onChange={(e) => handleFilter('town', e.target.value)} style={filterStyle}>
                  <option value="">All Towns</option>
                  {townOptions.map((o) => <option key={o.town} value={o.town}>{o.town}</option>)}
                </select>
              ),
            },
            {
              key: 'flatType',
              el: (
                <select value={filters.flatType} onChange={(e) => handleFilter('flatType', e.target.value)} style={filterStyle}>
                  <option value="">All Flat Types</option>
                  {FLAT_TYPES.map((t) => <option key={t} value={t}>{t.replace('ROOM', 'Rm')}</option>)}
                </select>
              ),
            },
            {
              key: 'storeyRange',
              el: (
                <select value={filters.storeyRange} onChange={(e) => handleFilter('storeyRange', e.target.value)} style={filterStyle}>
                  <option value="">All Storeys</option>
                  {STOREY_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ),
            },
            {
              key: 'minPrice',
              el: (
                <input
                  type="number"
                  placeholder={priceStats ? `Min (S$${priceStats.minPrice.toLocaleString()})` : 'Min Price'}
                  value={filters.minPrice}
                  onChange={(e) => handleFilter('minPrice', e.target.value)}
                  style={filterStyle}
                />
              ),
            },
            {
              key: 'maxPrice',
              el: (
                <input
                  type="number"
                  placeholder={priceStats ? `Max (S$${priceStats.maxPrice.toLocaleString()})` : 'Max Price'}
                  value={filters.maxPrice}
                  onChange={(e) => handleFilter('maxPrice', e.target.value)}
                  style={filterStyle}
                />
              ),
            },
          ].map(({ key, el }) => <div key={key}>{el}</div>)}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
            Showing <span style={{ color: '#0F172A', fontWeight: 600 }}>{startItem}–{endItem}</span> of{' '}
            <span style={{ color: '#0F172A', fontWeight: 600 }}>{total.toLocaleString()}</span> results
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...filterStyle, minWidth: '160px' }}>
              <option value="latest">Latest Transaction</option>
              <option value="highest_price">Highest Price</option>
              <option value="lowest_price">Lowest Price</option>
              <option value="highest_psf">Highest PSF</option>
              <option value="lowest_psf">Lowest PSF</option>
            </select>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={filterStyle}>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ borderRadius: '14px', overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                <div style={{ height: '160px', background: '#E2E8F0' }} />
                <div style={{ padding: '16px' }}>
                  <div style={{ height: '20px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '8px' }} />
                  <div style={{ height: '14px', background: '#F1F5F9', borderRadius: '6px', width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
              {properties.map((prop, idx) => {
                const [c1, c2] = GRADIENT_COLORS[idx % GRADIENT_COLORS.length];
                return (
                  <Link
                    key={`${prop.town}-${prop.street_name}-${prop.block}`}
                    to={buildPath(prop.town, prop.street_name, prop.block)}
                    style={{
                      display: 'block', borderRadius: '14px', overflow: 'hidden',
                      background: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      textDecoration: 'none', transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
                      border: '2px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(59,130,246,0.22)';
                      e.currentTarget.style.borderColor = '#3B82F6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <div style={{ height: '148px', background: `linear-gradient(135deg, ${c1}, ${c2})`, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.55)', color: '#FFFFFF', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px' }}>
                        {prop.town}
                      </span>
                      <span style={{ position: 'absolute', top: '10px', right: '10px', background: '#C9A84C', color: '#0A1628', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px' }}>
                        Blk {prop.block}
                      </span>
                      <svg style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', opacity: 0.18 }} width="120" height="80" viewBox="0 0 120 80" fill="white">
                        <rect x="10" y="20" width="20" height="60" />
                        <rect x="35" y="5" width="28" height="75" />
                        <rect x="68" y="15" width="22" height="65" />
                        <rect x="95" y="30" width="18" height="50" />
                      </svg>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <p style={{ color: '#1B2B5E', fontSize: '22px', fontWeight: 800, margin: '0 0 2px', lineHeight: 1.2 }}>{formatCurrency(prop.avg_resale_price)}</p>
                      <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 10px' }}>SGD {(prop.avg_psf || 0).toFixed(0)} psf</p>
                      <p style={{ color: '#1E293B', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{prop.street_name}</p>
                      <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>{prop.total_transactions} transactions</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={paginationBtnStyle(currentPage === 1)}>
                  ← Previous
                </button>
                <span style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Page <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{currentPage}</span> of {totalPages}
                </span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={paginationBtnStyle(currentPage === totalPages)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const filterStyle: React.CSSProperties = {
  width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1',
  background: '#FFFFFF', padding: '10px 12px', color: '#0F172A', fontSize: '14px', outline: 'none',
};

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 20px', borderRadius: '8px', border: 'none',
  background: disabled ? '#1E3A5F' : '#3B82F6', color: disabled ? '#475569' : '#FFFFFF',
  fontWeight: 600, fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
});

export default Search;
