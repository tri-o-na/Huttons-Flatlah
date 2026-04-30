import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { emoji: '🏠', title: 'Browse Listings', desc: 'Filter by town, flat type, price and storey', to: '/search' },
  { emoji: '🗺️', title: 'Interactive Map', desc: 'Visualise HDB prices across Singapore', to: '/map' },
  { emoji: '📈', title: 'Town Analytics', desc: "Deep dive into any HDB town's market data", to: '/towns' },
  { emoji: '⚖️', title: 'Compare Towns', desc: 'Compare up to 5 towns side by side', to: '/comparison' },
];

const Home = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [buyerHover, setBuyerHover] = useState(false);
  const [sellerHover, setSellerHover] = useState(false);
  const [featureHover, setFeatureHover] = useState<number | null>(null);

  useEffect(() => { document.title = 'FlatLah'; }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#FFFFFF', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Hero ── */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 16px 64px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <img src="/logo.png" alt="FlatLah" style={{ height: '120px', width: '120px', objectFit: 'contain', borderRadius: '16px' }} />
          <span style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '-0.03em', color: '#FFFFFF' }}>FlatLah</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#94A3B8', margin: '0 0 12px', letterSpacing: '0.01em' }}>
          Singapore's HDB Resale Intelligence Platform
        </h1>
        <p style={{ color: '#475569', fontSize: '15px', margin: '0 0 48px' }}>
          229,000+ transactions · 26 towns · Data from Jan 2017 to Apr 2026
        </p>
        <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: '620px', position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by town, street, block or flat type..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '16px 56px 16px 52px',
              borderRadius: '14px', border: '1px solid #1E3A5F', background: '#0F2137',
              color: '#FFFFFF', fontSize: '16px', outline: 'none',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)', transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
            onBlur={(e) => (e.target.style.borderColor = '#1E3A5F')}
          />
          <svg style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button type="submit" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: '#3B82F6', border: 'none', borderRadius: '9px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFFFFF' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </section>

      {/* ── User type cards ── */}
      <section style={{ padding: '0 16px 64px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div onClick={() => navigate('/map')} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', borderLeft: '4px solid #3B82F6', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s', transform: buyerHover ? 'translateY(-4px)' : 'none', boxShadow: buyerHover ? '0 16px 40px rgba(59,130,246,0.28)' : '0 4px 16px rgba(0,0,0,0.2)' }} onMouseEnter={() => setBuyerHover(true)} onMouseLeave={() => setBuyerHover(false)}>
            <p style={{ fontSize: '28px', margin: '0 0 10px' }}>🔍</p>
            <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>I'm a Buyer</h2>
            <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.6 }}>Find your next home and explore resale prices</p>
            <button style={{ background: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Explore Map →</button>
          </div>
          <div onClick={() => navigate('/towns')} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', borderLeft: '4px solid #C9A84C', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s', transform: sellerHover ? 'translateY(-4px)' : 'none', boxShadow: sellerHover ? '0 16px 40px rgba(201,168,76,0.28)' : '0 4px 16px rgba(0,0,0,0.2)' }} onMouseEnter={() => setSellerHover(true)} onMouseLeave={() => setSellerHover(false)}>
            <p style={{ fontSize: '28px', margin: '0 0 10px' }}>📊</p>
            <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>I'm a Seller / Agent</h2>
            <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.6 }}>Price your unit using real market data</p>
            <button style={{ background: '#C9A84C', color: '#0A1628', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>View Town Analytics →</button>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section style={{ padding: '0 16px 96px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 32px' }}>Explore the platform</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {FEATURES.map((f, i) => (
              <div key={f.to} onClick={() => navigate(f.to)} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s', transform: featureHover === i ? 'translateY(-4px)' : 'none', boxShadow: featureHover === i ? '0 12px 32px rgba(59,130,246,0.22)' : '0 2px 12px rgba(0,0,0,0.15)', border: featureHover === i ? '2px solid #3B82F6' : '2px solid transparent' }} onMouseEnter={() => setFeatureHover(i)} onMouseLeave={() => setFeatureHover(null)}>
                <p style={{ fontSize: '28px', margin: '0 0 12px' }}>{f.emoji}</p>
                <h3 style={{ color: '#0F172A', fontSize: '15px', fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
                <p style={{ color: '#64748B', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
