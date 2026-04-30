import { NavLink, Outlet } from 'react-router-dom';

const Layout = () => {
  const navItems = [
    { to: '/search', label: 'Search' },
    { to: '/map', label: 'Map' },
    { to: '/towns', label: 'Town Analytics' },
    { to: '/comparison', label: 'Comparison' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628' }}>
      <nav
        style={{
          background: '#0A1628',
          borderBottom: '1px solid #1E3A5F',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
          }}
        >
          {/* Logo */}
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/logo2.png" alt="FlatLah" style={{ height: '56px', objectFit: 'contain' }} />
          </NavLink>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  background: isActive ? '#3B82F6' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  );
};

export default Layout;