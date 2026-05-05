# Stadium Flow Advisory

Stadium Flow Advisory is a full-stack prototype for stadium entry management. It recommends the fastest gate for a fan based on walking time plus queue delay, lets fans report and verify crowd conditions, and gives organizers a live control surface for gate operations, alerts, and crowd-photo privacy masking.

This repository is a monorepo with:

- a `Next.js` frontend in `apps/web`
- an `Express` API in `apps/api`
- a file-backed SQLite database implemented through `sql.js`

The current codebase is a working prototype, not a hardened production system. The major end-to-end flows are implemented, but there is no authentication, no automated test suite, and no anti-abuse layer.

## What The Project Does

### Fan-facing features

- Requests the user's geolocation and computes the fastest visible gate.
- Combines walking time and queue delay instead of using nearest-gate routing only.
- Draws the recommended walking route on a Leaflet map.
- Shows live queue pressure, verified crowd signals, and an update feed.
- Lets fans submit crowd reports tied to a gate and GPS position.
- Lets nearby fans verify pending reports.
- Updates routing impact once enough nearby fans confirm the same report.
- Tracks a reward profile with detour points, report reputation, and food-perk redemption.

### Organizer-facing features

- Lists all gates and supports editing their operational properties.
- Creates new gates with map-assisted coordinate placement.
- Toggles gate visibility so hidden gates drop out of routing.
- Adjusts queue length, service rate, crowd score, and directional hints.
- Publishes organizer updates into the shared live feed.
- Shows recent fan-submitted reports and whether they are pending or verified.
- Includes a visual command center for manual reroute simulation and localized alert blasting.
- Includes a browser-only privacy studio for blurring faces in uploaded photos or live camera frames.

## Repository Layout

```text
.
|- apps/
|  |- api/
|  |  |- data/                  Primary API database location
|  |  `- src/
|  |     |- config/
|  |     |- controllers/
|  |     |- routes/
|  |     `- services/
|  `- web/
|     |- app/
|     |- components/
|     `- lib/
|- contracts/                   Present but currently empty
|- DOCUMENTATION.md             Full technical documentation
|- README.md
|- package.json
`- package-lock.json
```

## Tech Stack

### Frontend

- Next.js `14.2.5`
- React `18.3.1`
- TypeScript
- Leaflet
- OpenStreetMap tiles

### Backend

- Node.js
- Express `4.21.2`
- `sql.js` `1.13.0`
- CORS
- dotenv

### Browser and external APIs

- Browser Geolocation API
- Browser MediaDevices API
- Browser `FaceDetector` API when available
- OpenCV.js fallback for face detection and blur
- Public OSRM walking-route API at `https://router.project-osrm.org`

## High-Level Architecture

The frontend talks directly to the backend over HTTP using helpers in `apps/web/lib/api.ts`.

The backend exposes four main API groups:

- `/api/gates`
- `/api/reports`
- `/api/updates`
- `/api/rewards`

At startup, the API:

1. loads environment variables from `apps/api/.env`
2. initializes the SQLite database through `sql.js`
3. creates required tables if they are missing
4. seeds starter gates and one starter update when the database is empty
5. starts the Express server

Routing is computed server-side. Each visible gate is scored as:

`totalMinutes = walkingMinutes + queueMinutes`

Queue time is estimated from:

`queueLength / adjustedServiceRate`

where:

`adjustedServiceRate = max(serviceRatePerMinute - liveCrowdScore * 0.05, 1)`

Crowd reports do not immediately affect routing. A report changes routing only after it reaches the configured verification threshold.

## Main User Flows

### Fan flow

1. Open `/fan`.
2. The frontend restores the display name from `localStorage` key `fan-name`.
3. The dashboard loads gates, updates, reward profile, and live crowd state.
4. The browser requests geolocation permission.
5. If location is available, the frontend requests `/api/gates/recommendation`.
6. The API returns the recommended gate, alternatives, and route data.
7. The fan can:
   - refresh the route
   - resync GPS
   - claim detour points
   - redeem a food discount
   - submit a crowd report
   - verify nearby pending reports

### Organizer flow

1. Open `/organizer`.
2. The frontend loads gates, updates, and live crowd state.
3. The organizer can:
   - select and edit gates
   - create a new gate
   - drag or click on the map to set coordinates
   - update queue and crowd simulation values
   - hide a gate from fan routing
   - publish organizer updates
   - use the command center to draft localized alerts
   - use the privacy studio to blur faces before export

## Prerequisites

- Node.js `18+`
- npm

## Installation

From the repository root:

```bash
npm install
```

## Environment Variables

### API: `apps/api/.env`

The API loads environment variables from `apps/api/.env`.

Example:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
REPORT_VERIFICATION_THRESHOLD=3
REPORT_RADIUS_METERS=160
REPORT_WINDOW_MINUTES=8
```

Optional:

```env
SQLITE_PATH=./data/stadium-flow.sqlite
```

Meaning:

- `PORT`: API port.
- `CLIENT_ORIGIN`: allowed CORS origin for the frontend.
- `SQLITE_PATH`: database file path. If omitted, the API defaults to `apps/api/data/stadium-flow.sqlite`.
- `REPORT_VERIFICATION_THRESHOLD`: total votes needed to verify a crowd report.
- `REPORT_RADIUS_METERS`: maximum distance from a report location allowed for verification.
- `REPORT_WINDOW_MINUTES`: live snapshot window for recent reports.

Important path note:

- If you set `SQLITE_PATH` inside `apps/api/.env`, use `./data/stadium-flow.sqlite`, not `./apps/api/data/stadium-flow.sqlite`.
- The longer path creates a nested `apps/api/apps/api/data` directory when the API runs from the workspace package directory.

### Web: `apps/web/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Meaning:

- `NEXT_PUBLIC_API_BASE_URL`: public API base URL used by the frontend.

## Running Locally

Start the API:

```bash
npm run dev:api
```

Start the frontend in another terminal:

```bash
npm run dev:web
```

Default local URLs:

- frontend: `http://localhost:3000`
- API health check: `http://localhost:4000/health`
- API base: `http://localhost:4000/api`

## Available Root Scripts

```bash
npm run dev:web
npm run dev:api
npm run lint:web
npm run start:api
```

## Data Model

The API persists five tables:

- `gates`
- `updates`
- `reward_profiles`
- `crowd_reports`
- `crowd_report_votes`

Seed data on first boot:

- 4 gates
- 1 organizer update

The starter coordinates are around Mumbai and the date formatting in the UI uses `en-IN`.

## API Overview

### Health

- `GET /health`

### Gates

- `GET /api/gates`
- `GET /api/gates/recommendation?latitude=...&longitude=...`
- `POST /api/gates`
- `PUT /api/gates/:gateId`

### Reports

- `GET /api/reports`
- `GET /api/reports/live`
- `POST /api/reports`
- `POST /api/reports/:reportId/verify`

### Updates

- `GET /api/updates`
- `POST /api/updates`

### Rewards

- `GET /api/rewards/profile?fanName=...`
- `POST /api/rewards/detour-points`
- `POST /api/rewards/redeem-food`

`DOCUMENTATION.md` contains the full endpoint behavior, response shapes, and implementation notes.

## Frontend Routes

- `/` landing page
- `/fan` fan dashboard
- `/organizer` organizer dashboard

## Feature Inventory

### Routing and recommendations

- Visible gates only are eligible for recommendation.
- Walking routes come from OSRM when available.
- If OSRM fails, the backend falls back to haversine distance plus a fixed walking speed.
- Each gate gets a status of `optimal`, `steady`, or `congested`.
- The API returns a recommendation summary, alternatives, saved minutes, and a detour incentive payload.

### Crowd reporting

- A submitted report starts as `pending`.
- The author's submission immediately counts as the first vote.
- Nearby fans can verify a report only once.
- Verification requires being within the configured distance radius.
- Once the threshold is met, the report becomes `verified`.

### Verified crowd-pressure effects

- Verified reports raise the target gate's queue length and crowd score to at least the configured level floor.
- A system-generated organizer-style update is written to the feed.
- Routing responses reflect the changed gate state on subsequent requests.

### Rewards

- Detour acceptance can award `40` points.
- Verified report authors get `30` points and `+2` report reputation.
- Additional verifiers get `10` points and `+1` report reputation.
- Food discount redemption costs `200` points.

### Fan dashboard

- Polls live data every `15` seconds.
- Displays route summary, alternative gates, queue charts, and report verification cards.
- Stores fan identity only as a display name in browser `localStorage`.

### Organizer dashboard

- Polls live data every `10` seconds.
- Supports gate creation, editing, visibility toggling, and coordinate placement.
- Shows active fan reports and a shared timeline of updates.

### Command center

- Uses a blueprint-style interface with sectors and corridors.
- Accepts draggable barricade tokens.
- Tracks local corridor status as open, rerouted, or closed.
- Publishes sector alerts through the real updates API.

### Privacy studio

- Works fully in-browser.
- Supports uploaded photos and live camera mode.
- Uses browser `FaceDetector` first.
- Falls back to OpenCV.js Haar cascade detection if available.
- Supports manual masking rectangles.
- Exports protected frames as PNG files.

## Current Limitations

- No authentication or authorization.
- No organizer-only backend protection.
- No rate limiting or anti-spam controls.
- No proof-of-arrival check for detour rewards.
- No coupon issuance service for redemptions.
- No automatic decay of crowd pressure after verification.
- No automated tests.
- No CI configuration.
- `contracts/` exists but is empty.
- No committed deployment manifest is present in the repository root.

## Documentation Guide

Read `DOCUMENTATION.md` for:

- complete architecture details
- database schema
- endpoint-by-endpoint API documentation
- routing algorithm notes
- frontend feature breakdown
- known gaps and implementation caveats

## Quick File Guide

- `apps/api/src/server.js`: API bootstrap
- `apps/api/src/config/database.js`: database initialization and persistence
- `apps/api/src/services/routingService.js`: route scoring
- `apps/api/src/services/crowdReportService.js`: reporting and verification logic
- `apps/api/src/services/rewardService.js`: rewards
- `apps/web/components/FanDashboard.tsx`: fan experience
- `apps/web/components/OrganizerDashboard.tsx`: organizer experience
- `apps/web/components/CrowdPrivacyStudio.tsx`: privacy masking feature
