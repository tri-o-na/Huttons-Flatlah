import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import axios from 'axios';
import { formatCurrency } from '../utils/format';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  ResponsiveContainer, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

/* ─── Types ─── */
interface TownSummary {
  town: string;
  total_transactions: number;
  avg_resale_price: number;
  avg_psf: number;
  most_popular_flat_type: string;
}
interface PropertyBlock {
  town: string;
  street_name: string;
  block: string;
  avg_resale_price: number;
  avg_psf: number;
  total_transactions: number;
}

type LatLng = [number, number];

interface OneMapResult {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  X: string;
  Y: string;
  LATITUDE: string;
  LONGITUDE: string;
  LONGTITUDE: string;
}

/* ─── Coordinates ─── */
const COORDINATES: Record<string, [number, number]> = {
  'ANG MO KIO': [1.3691, 103.8467], BEDOK: [1.3268, 103.9307],
  BISHAN: [1.3515, 103.848], 'BUKIT BATOK': [1.3491, 103.7496],
  'BUKIT MERAH': [1.2819, 103.8239], 'BUKIT PANJANG': [1.3774, 103.7719],
  'BUKIT TIMAH': [1.3294, 103.8021], 'CENTRAL AREA': [1.2897, 103.8515],
  'CHOA CHU KANG': [1.384, 103.7443], CLEMENTI: [1.314, 103.7651],
  GEYLANG: [1.3182, 103.8871], HOUGANG: [1.3612, 103.8863],
  'JURONG EAST': [1.3333, 103.7426], 'JURONG WEST': [1.3396, 103.7073],
  'KALLANG/WHAMPOA': [1.31, 103.8651], 'MARINE PARADE': [1.3027, 103.9072],
  'PASIR RIS': [1.373, 103.9493], PUNGGOL: [1.4044, 103.9024],
  QUEENSTOWN: [1.2942, 103.806], SEMBAWANG: [1.4491, 103.8201],
  SENGKANG: [1.3917, 103.8955], SERANGOON: [1.3498, 103.8737],
  TAMPINES: [1.3547, 103.9437], 'TOA PAYOH': [1.3328, 103.845],
  WOODLANDS: [1.436, 103.786], YISHUN: [1.4294, 103.8354],
};

const CARD_GRADIENTS = [
  ['#3B82F6','#1D4ED8'], ['#8B5CF6','#6D28D9'], ['#EC4899','#BE185D'],
  ['#14B8A6','#0F766E'], ['#F97316','#C2410C'], ['#C9A84C','#92400E'],
  ['#06B6D4','#0E7490'], ['#22C55E','#15803D'],
];

const PSF_LEGEND = [
  { color: '#22c55e', label: '< $400' }, { color: '#eab308', label: '$400–$550' },
  { color: '#f97316', label: '$550–$700' }, { color: '#ef4444', label: '> $700' },
];

/* ─── Helpers ─── */
function getPsfColor(psf: number) {
  if (psf < 400) return '#22c55e';
  if (psf < 550) return '#eab308';
  if (psf < 700) return '#f97316';
  return '#ef4444';
}

function createDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createTownCountIcon(color: string, count: number): L.DivIcon {
  const label = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  const size = count >= 100 ? 44 : 38;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;font-family:system-ui,sans-serif;">${label}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Emoji-based amenity icons (no extra deps)
const AMENITY_META: Record<Amenity['kind'], { emoji: string; bg: string; label: string }> = {
  school: { emoji: '🏫', bg: '#F59E0B', label: 'School' },
  mrt: { emoji: '🚇', bg: '#0EA5E9', label: 'MRT' },
  bus: { emoji: '🚌', bg: '#10B981', label: 'Bus Stop' },
  park: { emoji: '🌳', bg: '#22C55E', label: 'Park' },
};

function createAmenityIcon(kind: Amenity['kind']): L.DivIcon {
  const meta = AMENITY_META[kind];
  return L.divIcon({
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${meta.bg};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;">${meta.emoji}</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createLocationPinIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#EF4444" stroke="white" stroke-width="2">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 28],
  });
}

function buildPath(town: string, street: string, block: string) {
  return `/property/${encodeURIComponent(town.replace(/\s+/g, '-'))}/${encodeURIComponent(street.replace(/\s+/g, '-'))}/${encodeURIComponent(block.replace(/\s+/g, '-'))}`;
}

function getBlockKey(p: PropertyBlock) {
  return `${p.town}||${p.street_name}||${p.block}`;
}

function loadGeoCache(): Record<string, LatLng> {
  try {
    const raw = localStorage.getItem('geoCacheV1');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LatLng>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveGeoCache(cache: Record<string, LatLng>) {
  try {
    localStorage.setItem('geoCacheV1', JSON.stringify(cache));
  } catch {
    // ignore
  }
}

const MapResizer = ({ dep }: { dep: boolean }) => {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 320); }, [dep, map]);
  return null;
};

// Component to capture map reference
const MapController = ({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

// Track viewport zoom and bounds for lazy geocoding
const ViewportTracker = ({
  onChange,
}: {
  onChange: (info: { zoom: number; bounds: L.LatLngBounds }) => void;
}) => {
  const map = useMapEvents({
    moveend: () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() }),
    zoomend: () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() }),
  });
  // Fire once on mount
  useEffect(() => {
    onChange({ zoom: map.getZoom(), bounds: map.getBounds() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

/* ─── Cluster Layer Component ─── */
const ClusterLayer = ({ 
  listings, 
  onPropertyClick 
}: { 
  listings: Array<{ prop: PropertyBlock; pos: LatLng }>;
  onPropertyClick: (prop: PropertyBlock) => void;
}) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    // Create cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 80,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true,
    });

    // Add markers to cluster
    listings.forEach(({ prop, pos }) => {
      const marker = L.marker(pos, {
        icon: createDotIcon('#3B82F6'),
      });

      const popupContent = `
        <div style="font-size:13px;min-width:200px;">
          <strong>Blk ${prop.block}</strong><br/>
          ${prop.street_name}<br/>
          <span style="color:#64748B">${prop.town}</span><br/>
          <hr style="margin:8px 0;border:none;border-top:1px solid #E2E8F0"/>
          Avg Price: ${formatCurrency(prop.avg_resale_price)}<br/>
          Avg PSF: SGD ${(prop.avg_psf || 0).toFixed(0)}<br/>
          Transactions: ${prop.total_transactions.toLocaleString()}<br/>
          <button onclick="window._handlePropertyClick('${getBlockKey(prop)}')"
             style="display:inline-block;margin-top:8px;padding:6px 12px;background:#3B82F6;color:#FFFFFF;border-radius:6px;font-weight:600;text-decoration:none;font-size:12px;border:none;cursor:pointer;">
            View Details →
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on('click', () => {
        onPropertyClick(prop);
      });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    return () => {
      map.removeLayer(clusterGroup);
      clusterRef.current = null;
    };
  }, [map, listings, onPropertyClick]);

  return null;
};

/* ─── OneMap Search Hook ─── */
function useOneMapSearch(query: string, minChars = 3) {
  const [results, setResults] = useState<OneMapResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < minChars) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await axios.get('http://localhost:3002/api/onemap/search', {
          params: { query: query.trim() }
        });
        if (!cancelled) {
          setResults(r.data?.results || []);
        }
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, minChars]);

  return { results, loading };
}

/* ─── Property card ─── */
const PropertyCard = ({ prop, index, onClick }: { prop: PropertyBlock; index: number; onClick?: () => void }) => {
  const [c1, c2] = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  return (
    <div 
      onClick={onClick}
      style={{
        background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden',
        marginBottom: '10px', border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Gradient image placeholder */}
      <div style={{
        width: '88px', flexShrink: 0,
        background: `linear-gradient(160deg, ${c1}, ${c2})`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '10px 6px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em' }}>BLK</span>
        <span style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 800, lineHeight: 1 }}>{prop.block}</span>
        <svg style={{ marginTop: '8px', opacity: 0.45 }} width="32" height="20" viewBox="0 0 32 20" fill="white">
          <rect x="0" y="7" width="7" height="13" /><rect x="9" y="2" width="14" height="18" /><rect x="25" y="9" width="7" height="11" />
        </svg>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '11px 13px', minWidth: 0 }}>
        <p style={{ color: '#1B2B5E', fontSize: '13px', fontWeight: 700, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {prop.street_name}
        </p>
        <p style={{ color: '#94A3B8', fontSize: '11px', margin: '0 0 9px' }}>{prop.town}</p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '9px' }}>
          {[
            { label: 'AVG PRICE', value: formatCurrency(prop.avg_resale_price), highlight: true },
            { label: 'PSF', value: `$${(prop.avg_psf || 0).toFixed(0)}` },
            { label: 'TRANSACTIONS', value: String(prop.total_transactions) },
          ].map(({ label, value, highlight }) => (
            <div key={label}
              style={{
                flex: 1, minWidth: 0, background: highlight ? '#1B2B5E' : '#F8FAFC',
                borderRadius: '6px', padding: '5px 6px', textAlign: 'center',
              }}
            >
              <p style={{ color: highlight ? '#94A3B8' : '#94A3B8', fontSize: '8px', fontWeight: 600, letterSpacing: '0.04em', margin: '0 0 1px', whiteSpace: 'nowrap' }}>{label}</p>
              <p style={{ color: highlight ? '#FFFFFF' : '#1B2B5E', fontSize: '11px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
            </div>
          ))}
        </div>

        {onClick ? (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '5px 14px', background: '#3B82F6', color: '#FFFFFF',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
            }}>
            View
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        ) : (
          <Link to={buildPath(prop.town, prop.street_name, prop.block)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '5px 14px', background: '#3B82F6', color: '#FFFFFF',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
            }}>
            View
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
};
type SidebarView = 'town' | 'property' | null;

type PropertyDetailTab = 'general' | 'charts' | 'transactions' | 'nearby';

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

interface PropertyDetail {
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
    priceDistribution: Array<{ range: string; count: number }>;
  };
  transactions: Array<{
    id: number; month: string; flat_type: string; storey_range: string;
    floor_area_sqm: number; resale_price: number; psf: number;
    flat_model: string; remaining_lease: string;
  }>;
}

/* ─── Main ─── */
const Map = () => {
  useEffect(() => { document.title = 'FlatLah | Map'; }, []);
  const mapRef = useRef<L.Map | null>(null);
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [allListings, setAllListings] = useState<PropertyBlock[]>([]);
  const [selectedTownName, setSelectedTownName] = useState('');
  const [propertyList, setPropertyList] = useState<PropertyBlock[]>([]);
  const [totalProperties, setTotalProperties] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [blockCoords, setBlockCoords] = useState<Record<string, LatLng>>(() => loadGeoCache());
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });
  const [viewport, setViewport] = useState<{ zoom: number; bounds: L.LatLngBounds | null }>({ zoom: 11, bounds: null });

  // Zoom threshold above which we show individual listing dots (and start geocoding)
  const DETAIL_ZOOM = 14;
  
  // Property detail view state
  const [selectedProperty, setSelectedProperty] = useState<PropertyBlock | null>(null);
  const [propertyDetail, setPropertyDetail] = useState<PropertyDetail | null>(null);
  const [propertyDetailTab, setPropertyDetailTab] = useState<PropertyDetailTab>('general');
  const [loadingPropertyDetail, setLoadingPropertyDetail] = useState(false);
  const [nearbyAmenities, setNearbyAmenities] = useState<NearbyAmenities | null>(null);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [expandedAmenityKind, setExpandedAmenityKind] = useState<Amenity['kind'] | null>('school');

  // OneMap search for address autocomplete
  const { results: oneMapResults, loading: oneMapLoading } = useOneMapSearch(searchQuery, 2);

  // Load all listings on mount for clustering (fetch max allowed)
  useEffect(() => {
    axios.get('http://localhost:3002/api/properties/search?limit=5000')
      .then((r) => {
        setAllListings(r.data.data || []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    axios.get('http://localhost:3002/api/towns').then((r) => setTowns(r.data)).catch(console.error);
  }, []);

  // Lazy geocode: only geocode listings in current viewport when zoomed in enough
  useEffect(() => {
    if (allListings.length === 0) return;
    if (viewport.zoom < DETAIL_ZOOM || !viewport.bounds) {
      // At low zoom, don't geocode - we just show town count markers
      setGeocodingProgress({ current: 0, total: 0 });
      return;
    }

    let cancelled = false;

    const geocodeBatch = async () => {
      const nextCache: Record<string, LatLng> = { ...blockCoords };
      let changed = false;

      // Only fetch listings whose town centroid is within current bounds (rough filter)
      const bounds = viewport.bounds!;
      const inViewListings = allListings.filter((p) => {
        // Quick filter using town coords - if town is in/near viewport, include
        const townPos = COORDINATES[p.town];
        if (!townPos) return true; // unknown town - include to be safe
        const padded = bounds.pad(0.5);
        return padded.contains(L.latLng(townPos[0], townPos[1]));
      });

      const missing = inViewListings.filter((p) => !nextCache[getBlockKey(p)]);
      if (missing.length === 0) return;

      setGeocodingProgress({ current: 0, total: missing.length });

      const batchSize = 4;
      for (let i = 0; i < missing.length && !cancelled; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (p) => {
            const key = getBlockKey(p);
            try {
              const query = `${p.block} ${p.street_name} ${p.town}`;
              const r = await axios.get('http://localhost:3002/api/onemap/search', {
                params: { query }
              });
              const results = r.data?.results as Array<any> | undefined;
              const first = Array.isArray(results) ? results[0] : undefined;
              const lat = first?.LATITUDE ? Number(first.LATITUDE) : NaN;
              const lng = first?.LONGITUDE ? Number(first.LONGITUDE) : NaN;
              if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                nextCache[key] = [lat, lng];
                changed = true;
              }
            } catch (e) {
              // ignore per-item failures
            }
          })
        );

        if (!cancelled) {
          setGeocodingProgress({ current: Math.min(i + batchSize, missing.length), total: missing.length });
          // Incrementally update map state and cache so dots appear as they're geocoded
          if (changed) {
            setBlockCoords({ ...nextCache });
            saveGeoCache(nextCache);
            changed = false;
          }
        }

        if (i + batchSize < missing.length) {
          await new Promise((res) => setTimeout(res, 200));
        }
      }

      if (cancelled) return;
      setGeocodingProgress({ current: 0, total: 0 });
    };

    geocodeBatch();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allListings, viewport.zoom, viewport.bounds]);

  const filteredTowns = useMemo(
    () => towns.filter((t) => t.town.toLowerCase().includes(searchQuery.toLowerCase())),
    [towns, searchQuery]
  );

  // Count listings per town for marker badges
  const listingsByTown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allListings) {
      counts[p.town] = (counts[p.town] || 0) + 1;
    }
    return counts;
  }, [allListings]);

  // Get listings with coordinates for clustering
  const listingsWithCoords = useMemo(() => {
    return allListings
      .map((p) => ({ prop: p, pos: blockCoords[getBlockKey(p)] }))
      .filter((x): x is { prop: PropertyBlock; pos: LatLng } => Array.isArray(x.pos));
  }, [allListings, blockCoords]);

  // Filter listings - now always shows all listings unless in property detail view
  const filteredListings = useMemo(() => {
    // Always show all listings on map, filtering is only for search dropdown centering
    return listingsWithCoords;
  }, [listingsWithCoords]);

  const handleMarkerClick = async (town: TownSummary) => {
    setSidebarOpen(true);
    setSidebarView('town');
    setSelectedTownName(town.town);
    setPropertyList([]);
    setSelectedProperty(null);
    setPropertyDetail(null);
    setLoading(true);
    try {
      const r = await axios.get(
        `http://localhost:3002/api/properties/search?town=${encodeURIComponent(town.town)}&sortBy=highest_price&limit=20`
      );
      setPropertyList(r.data.data || []);
      setTotalProperties(r.data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Handle clicking a property listing
  const handlePropertyClick = async (prop: PropertyBlock) => {
    setSidebarOpen(true);
    setSidebarView('property');
    setSelectedProperty(prop);
    setLoadingPropertyDetail(true);
    setNearbyAmenities(null);
    
    // Center map on property
    const coords = blockCoords[getBlockKey(prop)];
    if (coords && mapRef.current) {
      mapRef.current.setView(coords, 17);
    }
    
    try {
      const r = await axios.get(
        `http://localhost:3002/api/properties/${encodeURIComponent(prop.town)}/${encodeURIComponent(prop.street_name)}/${encodeURIComponent(prop.block)}`
      );
      setPropertyDetail(r.data);
    } catch (e) { console.error(e); }
    setLoadingPropertyDetail(false);

    // Fetch nearby amenities (schools, MRT, bus, parks within 1.5km)
    if (coords) {
      setLoadingAmenities(true);
      try {
        const r = await axios.get('http://localhost:3002/api/amenities/nearby', {
          params: { lat: coords[0], lng: coords[1], radius: 1500 },
        });
        setNearbyAmenities(r.data);
      } catch (e) { console.error('Amenities fetch failed', e); }
      setLoadingAmenities(false);
    }
  };

  // Handle selecting an address from OneMap results
  const handleAddressSelect = useCallback((result: OneMapResult) => {
    const address = result.SEARCHVAL || result.ADDRESS;
    setSearchQuery(address);
    setShowSearchDropdown(false);
    
    // Center map if coordinates available
    if (result.LATITUDE && result.LONGITUDE && mapRef.current) {
      const lat = parseFloat(result.LATITUDE);
      const lng = parseFloat(result.LONGITUDE);
      mapRef.current.setView([lat, lng], 16);
    }
  }, []);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 64px)', background: '#F1F5F9' }}>

      {/* Search overlay with OneMap autocomplete */}
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '380px' }}>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search address, town, street, or block…" 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            style={{
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              background: 'rgba(255,255,255,0.96)',
              padding: '12px 40px 12px 16px',
              color: '#0F172A',
              fontSize: '14px',
              outline: 'none',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
              backdropFilter: 'blur(10px)',
              boxSizing: 'border-box',
            }} 
          />
          <svg style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}
            width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* OneMap Search Dropdown */}
          {showSearchDropdown && (searchQuery.trim().length >= 2) && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1001,
            }}>
              {oneMapLoading && (
                <div style={{ padding: '12px 16px', color: '#64748B', fontSize: '13px' }}>
                  Searching addresses...
                </div>
              )}
              
              {!oneMapLoading && oneMapResults.length === 0 && (
                <div style={{ padding: '12px 16px', color: '#64748B', fontSize: '13px' }}>
                  Type to search addresses...
                </div>
              )}

              {!oneMapLoading && oneMapResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddressSelect(result)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#0F172A',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 600 }}>{result.SEARCHVAL || result.ADDRESS}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    {result.BLK_NO && `Blk ${result.BLK_NO}, `}{result.ROAD_NAME}
                  </div>
                </button>
              ))}

              {/* Close button */}
              <button
                onClick={() => setShowSearchDropdown(false)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'center',
                  border: 'none',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#64748B',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Geocoding progress indicator */}
        {geocodingProgress.total > 0 && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#1D4ED8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #BFDBFE',
              borderTopColor: '#3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span>Loading map data: {geocodingProgress.current} / {geocodingProgress.total}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '32px', left: '16px', zIndex: 1000,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)',
        borderRadius: '12px', padding: '12px 14px', border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}>
        <p style={{ color: '#1B2B5E', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Avg PSF (SGD)</p>
        {PSF_LEGEND.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: '#64748B', fontSize: '11px' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, right: sidebarOpen ? '420px' : 0, transition: 'right 0.3s ease' }}>
        <MapContainer 
          center={[1.3521, 103.8198]} 
          zoom={11} 
          style={{ height: '100%', width: '100%' }}
        >
          <MapController mapRef={mapRef} />
          <MapResizer dep={sidebarOpen} />
          <ViewportTracker onChange={setViewport} />
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' 
          />

          {/* Town markers with listing count - shown only when zoomed out */}
          {viewport.zoom < DETAIL_ZOOM && sidebarView !== 'property' && filteredTowns.map((town) => {
            const pos = COORDINATES[town.town] || [1.3521, 103.8198];
            const count = listingsByTown[town.town] || 0;
            return (
              <Marker 
                key={town.town} 
                position={pos}
                icon={createTownCountIcon(getPsfColor(town.avg_psf || 0), count)}
                eventHandlers={{ click: () => handleMarkerClick(town) }}
              >
                <Popup>
                  <div style={{ fontSize: '13px' }}>
                    <strong>{town.town}</strong><br />
                    {count.toLocaleString()} listings<br />
                    Avg PSF: SGD {(town.avg_psf || 0).toFixed(0)}<br />
                    {town.total_transactions.toLocaleString()} transactions<br />
                    <em style={{ color: '#64748B', fontSize: '11px' }}>Zoom in to see individual listings</em>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Detail view: show only the selected property pin */}
          {sidebarView === 'property' && selectedProperty && (() => {
            const coords = blockCoords[getBlockKey(selectedProperty)];
            if (!coords) return null;
            return (
              <Marker 
                position={coords}
                icon={createLocationPinIcon()}
              >
                <Popup>
                  <div style={{ fontSize: '13px' }}>
                    <strong>Blk {selectedProperty.block}</strong><br />
                    {selectedProperty.street_name}<br />
                    {selectedProperty.town}
                  </div>
                </Popup>
              </Marker>
            );
          })()}

          {/* Nearby amenity markers in property detail view */}
          {sidebarView === 'property' && nearbyAmenities && (
            <>
              {[...nearbyAmenities.schools, ...nearbyAmenities.mrt, ...nearbyAmenities.bus, ...nearbyAmenities.parks].map((a, idx) => (
                <Marker
                  key={`${a.kind}-${idx}-${a.lat}-${a.lng}`}
                  position={[a.lat, a.lng]}
                  icon={createAmenityIcon(a.kind)}
                >
                  <Popup>
                    <div style={{ fontSize: '13px' }}>
                      <strong>{AMENITY_META[a.kind].label}:</strong> {a.name}<br />
                      <span style={{ color: '#64748B' }}>{a.distance_m} m away</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )}

          {/* Individual listings shown only when zoomed in (and not in property detail) */}
          {viewport.zoom >= DETAIL_ZOOM && sidebarView !== 'property' && (
            <ClusterLayer listings={filteredListings} onPropertyClick={handlePropertyClick} />
          )}
        </MapContainer>
      </div>

      {/* ── Sidebar ── */}
      <div style={{
        position: 'absolute', top: 0, right: 0, height: '100%',
        width: sidebarOpen ? '420px' : '0',
        overflow: 'hidden', transition: 'width 0.3s ease', zIndex: 1000,
        display: 'flex', flexDirection: 'column', background: '#F8FAFC',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
      }}>
        {sidebarOpen && sidebarView === 'town' && (
          <>
            {/* Town Header */}
            <div style={{
              background: '#1B2B5E', padding: '16px 18px', flexShrink: 0,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
            }}>
              <div>
                <h2 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, margin: '0 0 3px' }}>
                  {selectedTownName}
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>
                  {loading ? 'Loading…' : `${totalProperties.toLocaleString()} properties`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Link to={`/towns?town=${encodeURIComponent(selectedTownName)}`}
                  style={{
                    padding: '6px 12px', background: '#3B82F6', color: '#FFFFFF',
                    borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                  Town Analytics →
                </Link>
                <button onClick={() => {
                    setSidebarOpen(false);
                    setSidebarView(null);
                    setSelectedProperty(null);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', lineHeight: 0, padding: '2px' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sub-header note */}
            {!loading && propertyList.length > 0 && (
              <div style={{
                background: '#EFF6FF', padding: '7px 18px',
                borderBottom: '1px solid #BFDBFE', flexShrink: 0,
              }}>
                <p style={{ color: '#1D4ED8', fontSize: '11px', margin: 0 }}>
                  Showing top 20 by avg price · {totalProperties.toLocaleString()} total blocks in this town
                </p>
              </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ height: '96px', borderRadius: '12px', background: '#E2E8F0', marginBottom: '10px' }} />
                ))
              ) : propertyList.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', marginTop: '48px', fontSize: '14px' }}>No properties found.</p>
              ) : (
                propertyList.map((prop, i) => (
                  <PropertyCard 
                    key={`${prop.block}-${prop.street_name}-${i}`} 
                    prop={prop} 
                    index={i} 
                    onClick={() => handlePropertyClick(prop)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {sidebarOpen && sidebarView === 'property' && selectedProperty && (
          <>
            {/* Property Header */}
            <div style={{
              background: '#1B2B5E', padding: '16px 18px', flexShrink: 0,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Blk {selectedProperty.block} {selectedProperty.street_name}
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>
                  {selectedProperty.town}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Link to={buildPath(selectedProperty.town, selectedProperty.street_name, selectedProperty.block)}
                  style={{
                    padding: '6px 12px', background: '#3B82F6', color: '#FFFFFF',
                    borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                  Full Page →
                </Link>
                <button onClick={() => {
                    setSidebarOpen(false);
                    setSidebarView(null);
                    setSelectedProperty(null);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', lineHeight: 0, padding: '2px' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0', flexShrink: 0,
            }}>
              {[
                { id: 'general', label: 'General' },
                { id: 'charts', label: 'Charts' },
                { id: 'nearby', label: 'Nearby' },
                { id: 'transactions', label: 'Transactions' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPropertyDetailTab(tab.id as PropertyDetailTab)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    border: 'none',
                    background: propertyDetailTab === tab.id ? '#FFFFFF' : '#F8FAFC',
                    color: propertyDetailTab === tab.id ? '#1B2B5E' : '#64748B',
                    fontSize: '12px',
                    fontWeight: propertyDetailTab === tab.id ? 600 : 500,
                    borderBottom: propertyDetailTab === tab.id ? '2px solid #3B82F6' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Property Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {loadingPropertyDetail ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: '80px', borderRadius: '8px', background: '#E2E8F0', marginBottom: '12px' }} />
                ))
              ) : !propertyDetail ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', marginTop: '48px', fontSize: '14px' }}>Loading property details...</p>
              ) : (
                <>
                  {/* General Tab */}
                  {propertyDetailTab === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* KPI Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <p style={{ color: '#64748B', fontSize: '11px', margin: '0 0 4px' }}>Avg Price</p>
                          <p style={{ color: '#1B2B5E', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                            {formatCurrency(propertyDetail.kpis.avg_resale_price)}
                          </p>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <p style={{ color: '#64748B', fontSize: '11px', margin: '0 0 4px' }}>Avg PSF</p>
                          <p style={{ color: '#1B2B5E', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                            ${propertyDetail.kpis.avg_psf.toFixed(0)}
                          </p>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <p style={{ color: '#64748B', fontSize: '11px', margin: '0 0 4px' }}>Transactions</p>
                          <p style={{ color: '#1B2B5E', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                            {propertyDetail.kpis.total_transactions}
                          </p>
                        </div>
                        <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <p style={{ color: '#64748B', fontSize: '11px', margin: '0 0 4px' }}>Flat Type</p>
                          <p style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 700, margin: 0 }}>
                            {propertyDetail.kpis.most_common_flat_type}
                          </p>
                        </div>
                      </div>

                      {/* Property Info */}
                      <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <h3 style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Property Info</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                          <div><span style={{ color: '#64748B' }}>Block:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.block}</span></div>
                          <div><span style={{ color: '#64748B' }}>Street:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.street_name}</span></div>
                          <div><span style={{ color: '#64748B' }}>Town:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.town}</span></div>
                          <div><span style={{ color: '#64748B' }}>Model:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.flat_model}</span></div>
                          <div><span style={{ color: '#64748B' }}>Lease Start:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.lease_commence_date}</span></div>
                          <div><span style={{ color: '#64748B' }}>Remaining:</span> <span style={{ color: '#0F172A' }}>{propertyDetail.header.remaining_lease}</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Charts Tab */}
                  {propertyDetailTab === 'charts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <h3 style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Price Trend</h3>
                        <div style={{ height: '180px' }}>
                          {propertyDetail.charts.priceTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={propertyDetail.charts.priceTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis 
                                  dataKey="month" 
                                  tick={{ fontSize: 10 }} 
                                  angle={-45}
                                  textAnchor="end"
                                  height={50}
                                  interval="preserveStartEnd"
                                />
                                <YAxis 
                                  tick={{ fontSize: 10 }} 
                                  tickFormatter={(v) => `S${(v/1000).toFixed(0)}k`}
                                />
                                <Tooltip 
                                  formatter={(v: number) => formatCurrency(v)}
                                  labelStyle={{ fontSize: 12 }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="avgPrice" 
                                  stroke="#3B82F6" 
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: '#3B82F6' }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                              No price trend data available
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <h3 style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Price by Flat Type</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {propertyDetail.charts.avgPriceByFlatType.map((item) => (
                            <div key={item.flat_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#64748B', fontSize: '13px' }}>{item.flat_type}</span>
                              <span style={{ color: '#1B2B5E', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(item.avgPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <h3 style={{ color: '#1B2B5E', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Price by Storey</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {propertyDetail.charts.storeyRangeAvg.map((item) => (
                            <div key={item.storey_range} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#64748B', fontSize: '13px' }}>{item.storey_range}</span>
                              <span style={{ color: '#1B2B5E', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(item.avgPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nearby Tab */}
                  {propertyDetailTab === 'nearby' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {loadingAmenities && !nearbyAmenities ? (
                        <p style={{ color: '#64748B', fontSize: '13px' }}>Loading nearby amenities...</p>
                      ) : !nearbyAmenities ? (
                        <p style={{ color: '#64748B', fontSize: '13px' }}>No amenity data available.</p>
                      ) : (
                        <>
                          <p style={{ color: '#64748B', fontSize: '12px', margin: 0 }}>
                            Within {nearbyAmenities.radius_m} m of this block
                          </p>
                          {([
                            { kind: 'school' as const, items: nearbyAmenities.schools },
                            { kind: 'mrt' as const, items: nearbyAmenities.mrt },
                            { kind: 'bus' as const, items: nearbyAmenities.bus },
                            { kind: 'park' as const, items: nearbyAmenities.parks },
                          ]).map(({ kind, items }) => {
                            const meta = AMENITY_META[kind];
                            const isOpen = expandedAmenityKind === kind;
                            return (
                              <div key={kind} style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedAmenityKind(isOpen ? null : kind)}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                                  }}
                                >
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%', background: meta.bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0,
                                  }}>{meta.emoji}</div>
                                  <h3 style={{ color: '#1B2B5E', fontSize: '13px', fontWeight: 600, margin: 0, flex: 1 }}>
                                    {meta.label}s
                                  </h3>
                                  <span style={{ color: '#64748B', fontSize: '12px', fontWeight: 600 }}>{items.length}</span>
                                  <span style={{ color: '#64748B', fontSize: '12px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                                </button>
                                {isOpen && (
                                  <div style={{ padding: '0 12px 12px' }}>
                                    {items.length === 0 ? (
                                      <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>None within {nearbyAmenities.radius_m} m</p>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {items.map((a, i) => (
                                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                            <span style={{ color: '#0F172A', flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                                            <span style={{ color: '#3B82F6', fontWeight: 600, flexShrink: 0 }}>{a.distance_m} m</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* Transactions Tab */}
                  {propertyDetailTab === 'transactions' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ color: '#64748B', fontSize: '12px', margin: '0 0 8px' }}>
                        Showing {propertyDetail.transactions.length} transactions
                      </p>
                      {propertyDetail.transactions.slice(0, 20).map((tx) => (
                        <div key={tx.id} style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#1B2B5E', fontSize: '13px', fontWeight: 600 }}>{tx.month}</span>
                            <span style={{ color: '#3B82F6', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(tx.resale_price)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748B' }}>
                            <span>{tx.flat_type}</span>
                            <span>{tx.storey_range}</span>
                            <span>{tx.floor_area_sqm} sqm</span>
                            <span>${tx.psf.toFixed(0)} psf</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Map;
