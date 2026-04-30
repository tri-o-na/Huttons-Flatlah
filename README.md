# FlatLah — SG Resale HDB

Singapore's HDB Resale Intelligence Platform. A full-stack web application for exploring, analysing, and comparing HDB resale transaction data across all 26 towns.

> **Data coverage:** 229,000+ transactions · 26 towns · Jan 2017 – Apr 2026

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite + Prisma ORM
- **Libraries**: Recharts, Leaflet, Leaflet.MarkerCluster, Axios, Tailwind CSS

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Home** | Landing page |
| `/search` | **Search** | Property card grid with filters |
| `/map` | **Map** | Interactive Leaflet map |
| `/towns` | **Town Analytics** | Per-town deep-dive analytics |
| `/comparison` | **Comparison** | Side-by-side town comparison |
| `/property/:town/:street/:block` | **Property Detail** | Per-block detail view |

---

## Features

### 1. Home (Landing Page) — `/`
- **FlatLah** wordmark with logo
- Tagline and dataset stats
- Full-width search bar — on submit navigates to `/search?q=...`
- **User-type cards**: "I'm a Buyer" → Map, "I'm a Seller / Agent" → Town Analytics
- **Feature cards** (4-up grid): Browse Listings, Interactive Map, Town Analytics, Compare Towns
- Each card navigates to its respective page on click

### 2. Search Page — `/search`
- Picks up `?q=` and `?town=` URL params on load (deep-link support from Map and landing page)
- Full-text search with 300 ms debounce + AbortController (no stale results)
- Filters: town, flat type, storey range, min/max price (placeholders show dataset min/max)
- Sort by: latest transaction, highest price, lowest price, highest PSF, lowest PSF
- Paginated property cards (20 / 50 / 100 per page) linking to Property Detail

### 3. Map Page — `/map`
- Interactive Leaflet map centred on Singapore
- Town-level cluster dots at low zoom; property-level markers at high zoom
- Lazy loading: map dots load by zoom level and viewport bounds
- Geocoding via OneMap API with localStorage caching
- Sidebar: town summary → property list → property detail with tabs
  - **General**, **Charts**, **Amenities**, **Nearby Streets** tabs
- Nearby amenities (schools, MRT, bus stops, parks) fetched from Overpass API and shown as map markers with emoji icons
- Cross-navigation button → Town Analytics

### 4. Property Detail Page — `/property/:town/:street/:block`
- KPI cards: avg price, avg PSF, total transactions, most common flat type
- **Tabs**: General · Charts · Amenities · Nearby Streets
- Charts: price trend, price distribution, floor level vs price, floor area vs price, PSF trend, transaction volume, remaining lease correlation
- **Amenities tab**: collapsible cards for 🏫 Schools, 🚇 MRT, 🚌 Bus Stops, 🌳 Parks (Overpass API, 1.5 km radius)
- **Nearby Streets tab**: collapsible accordion
- Transaction table with sorting, pagination, CSV export
- Dynamic page title: `FlatLah | Blk {block} {street}`

### 5. Town Analytics Page — `/towns`
- Pre-selectable via `?town=` URL param (linked from Map sidebar)
- KPI cards: total transactions, avg price, avg PSF, YoY change, most transacted flat type
- Charts: price trend by flat type, transactions by year, flat type distribution (pie), avg PSF by flat type, top 10 streets (horizontal bar), YoY price change table
- Cross-navigation button → Comparison page
- Dynamic page title: `FlatLah | {town name}`

### 6. Comparison Page — `/comparison`
- Compare up to **5** towns side by side (updated from 3)
- Town picker with search filter
- KPI cards per town: avg price, avg PSF, transactions, top flat type, avg lease start, common remaining lease
- Charts: price trend overlay (line), avg PSF bar comparison, transaction volume bar comparison, flat type distribution (grouped bar)
- Cross-navigation button → Town Analytics page

---

## Navbar

- **Logo**: FlatLah horizontal logo (`logo2.png`) — links to `/`
- **Favicon**: Icon-only logo (`logo3.png`)
- **Nav links**: Search · Map · Town Analytics · Comparison
- Active link highlighted in blue (#3B82F6)
- Sticky top, dark navy background

---

## Installation and Setup

### Prerequisites
- Node.js (v16+)
- npm

### Backend Setup
1. Navigate to the backend directory:
   ```
   cd backend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Generate Prisma client:
   ```
   npx prisma generate
   ```
4. Create and migrate database:
   ```
   npx prisma migrate dev --name init
   ```
5. Seed the database with CSV data:
   ```
   npm run seed
   ```
6. Start the backend server:
   ```
   npm run dev
   ```
   The server runs on http://localhost:3002

### Frontend Setup
1. Navigate to the frontend directory:
   ```
   cd frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
   The app is available at http://localhost:5177

---

## API Endpoints

### Properties
- `GET /api/properties/search` — Search with filters (q, town, flatType, storeyRange, minPrice, maxPrice, sortBy, page, limit)
- `GET /api/properties/stats` — Dataset min/max price and PSF
- `GET /api/properties/:town/:street/:block` — Property detail
- `GET /api/properties/:town/:street/:block/charts` — Chart data for a block

### Towns
- `GET /api/towns` — All towns summary (for map and dropdowns)
- `GET /api/towns/:town` — Full analytics for a specific town
- `GET /api/towns/:town/comparison` — Comparison payload for a town

### Comparison
- `POST /api/comparison` — Compare multiple towns

### Amenities
- `GET /api/amenities/nearby?lat=&lng=&radius=` — Nearby POIs (schools, MRT, bus stops, parks) via Overpass API; radius capped at 3000 m

### OneMap Proxy
- `GET /api/onemap/search?query=` — Proxied geocoding via OneMap API

---

## Data Source

Dataset: `ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv` from [data.gov.sg](https://data.gov.sg), containing HDB resale transactions from January 2017 to April 2026.

---

## UI Design

- Dark navy background (`#0A1628`)
- Accent blue (`#3B82F6`), gold accent (`#C9A84C`)
- White and muted text (`#FFFFFF`, `#94A3B8`)
- Inter font (Google Fonts)
- Responsive grid layouts
- Smooth hover lift + shadow effects on all cards