# Stadium Flow Advisory

Stadium Flow Advisory is a monorepo for a stadium entry-routing platform. It has:

- a `Next.js` fan and organizer frontend in `apps/web`
- an `Express` + `sql.js` backend in `apps/api`
- a local SQLite file for persistence
- live gate recommendation logic based on walking time plus queue delay
- a crowd-report verification loop that can change routing after enough nearby fans confirm the same issue
- a lightweight reward system for detours and verified reporting

This repository currently ships as a working prototype. It includes real UI flows, persistent backend state, seeded sample gate data, organizer tools, and deployment configuration for the API.

## What The Project Does

For fans:

- reads the fan's geolocation
- requests the best gate recommendation from the API
- shows the route on a Leaflet map
- displays queue pressure, live updates, and reward profile data
- allows fans to submit crowd reports
- allows nearby fans to verify reports
- awards detour points and redeemable food-discount points

For organizers:

- manages gates, coordinates, visibility, service rates, queue length, and crowd score
- publishes live operational updates
- sees live fan-submitted crowd reports
- uses a visual command-center UI for manual reroute simulations
- uses an in-browser privacy masking tool for crowd photos and live camera frames

## Repository Layout

```text
.
|- apps/
|  |- api/                  Express API + SQLite/sql.js backend
|  `- web/                  Next.js frontend
|- contracts/               Present but currently empty
|- DOCUMENTATION.md         Detailed technical documentation
|- render.yaml              Render Blueprint for the API service
`- RENDER_API_DEPLOY.md     Short Render deployment note
```

## Tech Stack

Frontend:

- Next.js `14.2.5`
- React `18.3.1`
- TypeScript
- Leaflet + OpenStreetMap tiles

Backend:

- Node.js
- Express `4.21.2`
- `sql.js` `1.13.0`
- CORS
- dotenv

Persistence and data:

- SQLite database file stored at `apps/api/data/stadium-flow.sqlite` by default

External services and browser APIs:

- OSRM public routing API at `https://router.project-osrm.org`
- browser Geolocation API
- browser MediaDevices API
- browser FaceDetector API when available
- OpenCV.js fallback for face detection and blur

## Architecture Summary

The frontend talks directly to the API using fetch calls in [`apps/web/lib/api.ts`](/abs/path/C:/StadiumFlow/apps/web/lib/api.ts). The backend exposes four API groups:

- `/api/gates`
- `/api/reports`
- `/api/updates`
- `/api/rewards`

The API boots by:

1. loading environment variables
2. connecting to the SQLite database through `sql.js`
3. creating tables if they do not already exist
4. seeding initial gate and update records when the database is empty
5. starting the Express server

Fan routing is computed server-side. Each visible gate is scored as:

`totalMinutes = walkingMinutes + queueMinutes`

Walking time comes from OSRM when available. If OSRM fails, the server falls back to a local haversine-based straight-line estimate.

Queue time is estimated from:

`queueLength / adjustedServiceRate`

where `adjustedServiceRate = max(serviceRatePerMinute - liveCrowdScore * 0.05, 1)`

Crowd reports do not immediately change routing. A report must be verified by enough nearby fans before the backend:

- marks it as verified
- increases the target gate's queue and live crowd score
- creates a system update about the verified pressure
- awards reputation and points

## Main User Flows

### Fan flow

1. User opens `/fan`.
2. Frontend loads gates, updates, live crowd state, and reward profile.
3. Frontend requests GPS permission.
4. If GPS succeeds, frontend requests `/api/gates/recommendation`.
5. API ranks visible gates and returns the best option plus alternatives.
6. Fan can:
   - refresh route
   - sync GPS again
   - claim detour points
   - redeem food discounts
   - submit a crowd report
   - verify nearby pending reports

### Organizer flow

1. User opens `/organizer`.
2. Frontend loads gates, updates, and live crowd state.
3. Organizer can:
   - edit or create gates
   - place or move gates on a map
   - toggle gate visibility
   - update queue and crowd simulation values
   - publish feed updates
   - use the command center to draft reroute alerts
   - use the privacy studio to blur faces before export

## Prerequisites

- Node.js `18+` is recommended
- npm

## Installation

From the repository root:

```bash
npm install
```

## Environment Variables

Two environment files are expected for local development.

### `apps/api/.env`

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
SQLITE_PATH=./apps/api/data/stadium-flow.sqlite
REPORT_VERIFICATION_THRESHOLD=3
REPORT_RADIUS_METERS=160
REPORT_WINDOW_MINUTES=8
```

Meaning:

- `PORT`: API server port
- `CLIENT_ORIGIN`: allowed CORS origin for the frontend
- `SQLITE_PATH`: path to the SQLite database file
- `REPORT_VERIFICATION_THRESHOLD`: votes needed to mark a crowd report as verified
- `REPORT_RADIUS_METERS`: maximum distance allowed for report verification
- `REPORT_WINDOW_MINUTES`: active report cache window used for live snapshots

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Meaning:

- `NEXT_PUBLIC_API_BASE_URL`: public base URL used by the frontend fetch client

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

At the repository root:

```bash
npm run dev:web
npm run dev:api
npm run lint:web
npm run start:api
```

## Database Behavior

The backend uses `sql.js`, but persists its exported database bytes into a normal SQLite file path. On each write:

- SQL runs in-memory
- the database is exported
- the file is overwritten at `SQLITE_PATH`

Default tables:

- `gates`
- `updates`
- `reward_profiles`
- `crowd_reports`
- `crowd_report_votes`

On first boot, the seed service inserts:

- 4 starter gates
- 1 starter organizer update

## API Overview

### Health

- `GET /health`

Returns:

```json
{ "ok": true }
```

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

Full endpoint details are documented in [`DOCUMENTATION.md`](/abs/path/C:/StadiumFlow/DOCUMENTATION.md).

## Frontend Routes

- `/` landing page
- `/fan` fan dashboard
- `/organizer` organizer dashboard

## Important Implementation Details

- There is no authentication or role-based access control yet.
- Organizer actions are open to any user who can access the organizer page.
- Fan identity is just a display name stored in `localStorage` under `fan-name`.
- The frontend polls for live updates:
  - fan dashboard: every 15 seconds
  - organizer dashboard: every 10 seconds
- The API CORS policy allows a single origin from `CLIENT_ORIGIN`.
- Hidden gates are excluded from recommendation scoring.
- Detour points are not tied to proof of physical arrival; the frontend can claim them once conditions are met.
- Reward redemption uses points only. There is no coupon issuance service yet.
- The command center is currently a frontend simulation plus update publisher. It does not directly mutate gate routing data.
- The privacy studio runs entirely in the browser and can export masked images.

## Deployment

The repository includes a Render Blueprint in [`render.yaml`](/abs/path/C:/StadiumFlow/render.yaml).

It provisions:

- a Node web service named `stadiumflow-api`
- root directory `apps/api`
- `npm install` as the build command
- `npm start` as the start command
- `/health` as the health check
- a persistent disk mounted at `/opt/render/project/src/data`

Render-specific SQLite path:

```env
SQLITE_PATH=/opt/render/project/src/data/stadium-flow.sqlite
```

The disk is required because Render's default filesystem is ephemeral.

See [`RENDER_API_DEPLOY.md`](/abs/path/C:/StadiumFlow/RENDER_API_DEPLOY.md) for the short deployment note.

## Current Gaps And Limitations

- No automated tests are present in the repository.
- No CI configuration is present.
- No auth, sessions, or permissions exist.
- No rate limiting or abuse controls exist for report submission or reward claiming.
- OSRM uses a public endpoint; availability and latency are external dependencies.
- The API performs minimal validation and has no schema-validation layer.
- `contracts/` exists but currently contains no source files.
- There is no frontend production deployment configuration in this repository.

## Recommended Next Steps

- add request validation with a schema library
- add authentication for organizer actions
- move reward claiming behind a verified arrival or gate-scan event
- add automated tests for routing, verification, and reward logic
- add structured logging and error monitoring
- define the purpose of `contracts/` or remove it if unused

## Detailed Documentation

For the deeper technical reference, read [`DOCUMENTATION.md`](/abs/path/C:/StadiumFlow/DOCUMENTATION.md).
