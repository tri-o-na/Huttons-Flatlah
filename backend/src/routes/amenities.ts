import { Router } from 'express';

const router = Router();

// In-memory cache for amenities (key by lat/lng/radius)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

type AmenityKind = 'school' | 'mrt' | 'bus' | 'park';

interface Amenity {
  kind: AmenityKind;
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  details?: string;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

async function fetchOverpass(query: string): Promise<any> {
  let lastErr: any = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'HDB-Resale-App/1.0',
          Accept: 'application/json',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (r.ok) return await r.json();
      lastErr = `Overpass status ${r.status}`;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(String(lastErr));
}

function classifyElement(el: any): AmenityKind | null {
  const tags = el.tags || {};
  if (tags.amenity === 'school') return 'school';
  if (tags.highway === 'bus_stop') return 'bus';
  if (tags.leisure === 'park') return 'park';
  if (tags.railway === 'station' || tags.railway === 'subway_entrance' || tags.station === 'subway' || tags.station === 'light_rail') {
    return 'mrt';
  }
  return null;
}

router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = Math.min(3000, Math.max(100, parseInt((req.query.radius as string) || '1500', 10)));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Invalid lat/lng' });
    }

    const cacheKey = `${lat.toFixed(5)}|${lng.toFixed(5)}|${radius}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="school"](around:${radius},${lat},${lng});
        way["amenity"="school"](around:${radius},${lat},${lng});
        node["railway"="station"](around:${radius},${lat},${lng});
        node["station"="subway"](around:${radius},${lat},${lng});
        node["station"="light_rail"](around:${radius},${lat},${lng});
        node["highway"="bus_stop"](around:${radius},${lat},${lng});
        node["leisure"="park"](around:${radius},${lat},${lng});
        way["leisure"="park"](around:${radius},${lat},${lng});
      );
      out center tags;
    `;

    const data = await fetchOverpass(query);
    const elements = (data.elements || []) as any[];

    const amenities: Amenity[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const kind = classifyElement(el);
      if (!kind) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;
      const tags = el.tags || {};
      const name: string = tags.name || tags['name:en'] || (kind === 'bus' ? `Bus Stop ${tags.ref || ''}`.trim() : '');
      if (!name) continue;
      const distance_m = Math.round(haversineMeters(lat, lng, elLat, elLng));
      if (distance_m > radius) continue;
      // Dedupe by kind+name+rough position
      const dedupeKey = `${kind}|${name}|${elLat.toFixed(4)}|${elLng.toFixed(4)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      amenities.push({ kind, name, lat: elLat, lng: elLng, distance_m });
    }

    amenities.sort((a, b) => a.distance_m - b.distance_m);

    const grouped = {
      schools: amenities.filter((a) => a.kind === 'school'),
      mrt: amenities.filter((a) => a.kind === 'mrt'),
      bus: amenities.filter((a) => a.kind === 'bus'),
      parks: amenities.filter((a) => a.kind === 'park'),
      radius_m: radius,
    };

    cache.set(cacheKey, { data: grouped, ts: Date.now() });
    res.json(grouped);
  } catch (error) {
    console.error('Amenities error:', error);
    res.status(500).json({ error: 'Failed to load amenities', details: String(error) });
  }
});

export default router;
