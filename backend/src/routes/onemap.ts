import { Router } from 'express';

const router = Router();

// In-memory cache for OneMap responses
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Simple semaphore to limit concurrent OneMap requests
let inflight = 0;
const MAX_CONCURRENT = 4;
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function acquire() {
  while (inflight >= MAX_CONCURRENT) {
    await wait(50);
  }
  inflight++;
}
function release() {
  inflight = Math.max(0, inflight - 1);
}

async function fetchOneMap(query: string, pageNum: string): Promise<any> {
  const cacheKey = `${query}|${pageNum}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = new URL('https://www.onemap.gov.sg/api/common/elastic/search');
  url.searchParams.set('searchVal', query);
  url.searchParams.set('returnGeom', 'Y');
  url.searchParams.set('getAddrDetails', 'Y');
  url.searchParams.set('pageNum', pageNum);

  await acquire();
  try {
    // Retry up to 2 times with backoff on transient failures
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' }
        });
        if (r.ok) {
          const data = await r.json();
          cache.set(cacheKey, { data, ts: Date.now() });
          return data;
        }
        lastErr = `OneMap status ${r.status}`;
      } catch (e) {
        lastErr = e;
      }
      await wait(300 * (attempt + 1));
    }
    // After retries, return an empty results envelope so frontend doesn't error
    const empty = { found: 0, totalNumPages: 0, pageNum: 1, results: [], _proxyError: String(lastErr) };
    cache.set(cacheKey, { data: empty, ts: Date.now() });
    return empty;
  } finally {
    release();
  }
}

router.get('/search', async (req, res) => {
  try {
    const query = (req.query.query as string | undefined)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }
    const pageNum = String(req.query.pageNum ?? '1');
    const data = await fetchOneMap(query, pageNum);
    res.json(data);
  } catch (error) {
    console.error('OneMap proxy error:', error);
    // Always return 200 with empty results to avoid breaking the frontend
    res.json({ found: 0, totalNumPages: 0, pageNum: 1, results: [] });
  }
});

export default router;
