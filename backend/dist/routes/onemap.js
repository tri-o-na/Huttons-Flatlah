"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/search', async (req, res) => {
    try {
        const query = req.query.query?.trim();
        if (!query) {
            return res.status(400).json({ error: 'Missing query' });
        }
        const url = new URL('https://www.onemap.gov.sg/api/common/elastic/search');
        url.searchParams.set('searchVal', query);
        url.searchParams.set('returnGeom', 'Y');
        url.searchParams.set('getAddrDetails', 'Y');
        url.searchParams.set('pageNum', String(req.query.pageNum ?? '1'));
        const r = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        });
        if (!r.ok) {
            const text = await r.text();
            return res.status(502).json({ error: 'OneMap request failed', status: r.status, body: text });
        }
        const data = await r.json();
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to query OneMap' });
    }
});
exports.default = router;
