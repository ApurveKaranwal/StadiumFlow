# Stadium Flow Advisory Documentation

This document is the detailed technical reference for the Stadium Flow Advisory repository. It is based on the current implementation in the codebase, not on a hypothetical target architecture.

## 1. Project Purpose

Stadium Flow Advisory is a crowd-aware entry-routing prototype for sports venues or large event spaces. The goal is to direct fans to the fastest practical entry gate by combining:

- walking time from the fan's current location
- current queue length at each gate
- a live crowd-pressure signal
- organizer-configured operational hints

The system also lets fans contribute live crowd reports, lets nearby fans verify those reports, and lets organizers manage gates and publish operational updates.

## 2. Monorepo Structure

```text
.
|- apps/
|  |- api/
|  |  |- data/
|  |  `- src/
|  |     |- config/
|  |     |- controllers/
|  |     |- routes/
|  |     `- services/
|  `- web/
|     |- app/
|     |- components/
|     `- lib/
|- contracts/
|- DOCUMENTATION.md
|- README.md
|- render.yaml
`- RENDER_API_DEPLOY.md
```

## 3. Applications

### 3.1 `apps/web`

The frontend is a Next.js App Router application. It contains:

- landing page UI
- fan dashboard UI
- organizer dashboard UI
- shared client-side API utilities
- shared frontend types
- Leaflet map components
- client-side privacy masking tooling

### 3.2 `apps/api`

The backend is an Express application. It contains:

- environment configuration
- SQLite persistence through `sql.js`
- seed logic
- routing logic
- crowd-report and verification logic
- reward logic
- REST controllers and routes

## 4. Runtime Architecture

### 4.1 Frontend to backend flow

The frontend calls the backend directly over HTTP. The API base URL is controlled by `NEXT_PUBLIC_API_BASE_URL`.

Shared request helpers are in [`apps/web/lib/api.ts`](/abs/path/C:/StadiumFlow/apps/web/lib/api.ts).

### 4.2 Backend boot flow

Server startup is defined in [`apps/api/src/server.js`](/abs/path/C:/StadiumFlow/apps/api/src/server.js):

1. connect to the database
2. create required tables if missing
3. seed starter data if the database is empty
4. start Express on `env.port`

### 4.3 Data persistence model

The backend uses `sql.js`, which runs SQLite in-process. It persists by exporting the in-memory database to a file on each write. This is implemented in [`apps/api/src/config/database.js`](/abs/path/C:/StadiumFlow/apps/api/src/config/database.js).

Implications:

- no external database server is required
- local development is easy
- write throughput is limited compared to a full server-backed database
- persistence depends on a writable filesystem
- production deployment must use persistent storage if data should survive restarts

## 5. Configuration

### 5.1 Root workspace

The root [`package.json`](/abs/path/C:/StadiumFlow/package.json) uses npm workspaces:

- `apps/*`

Root scripts:

- `dev:web`
- `dev:api`
- `lint:web`
- `start:api`

### 5.2 API environment variables

Defined in [`apps/api/src/config/env.js`](/abs/path/C:/StadiumFlow/apps/api/src/config/env.js):

- `PORT`
- `SQLITE_PATH`
- `CLIENT_ORIGIN`
- `REPORT_VERIFICATION_THRESHOLD`
- `REPORT_RADIUS_METERS`
- `REPORT_WINDOW_MINUTES`

Defaults:

- `PORT=4000`
- `CLIENT_ORIGIN=http://localhost:3000`
- `REPORT_VERIFICATION_THRESHOLD=3`
- `REPORT_RADIUS_METERS=160`
- `REPORT_WINDOW_MINUTES=8`

### 5.3 Web environment variables

Used in [`apps/web/lib/api.ts`](/abs/path/C:/StadiumFlow/apps/web/lib/api.ts):

- `NEXT_PUBLIC_API_BASE_URL`

Default:

- `http://localhost:4000/api`

## 6. Database Schema

Table creation is implemented in [`apps/api/src/config/database.js`](/abs/path/C:/StadiumFlow/apps/api/src/config/database.js).

### 6.1 `gates`

Columns:

- `id` integer primary key
- `gate_id` unique text gate code
- `gate_name` text display name
- `display_order` integer
- `visible` integer boolean flag
- `zone_label` text
- `latitude` real
- `longitude` real
- `service_rate_per_minute` integer
- `queue_length` integer
- `live_crowd_score` integer
- `direction_hint` text
- `created_at` text ISO timestamp
- `updated_at` text ISO timestamp

Purpose:

- organizer-managed source of truth for available stadium gates

### 6.2 `updates`

Columns:

- `id`
- `author_type`
- `author_name`
- `message`
- `priority`
- `context`
- `created_at`
- `updated_at`

Purpose:

- stores organizer broadcasts and system-generated updates

### 6.3 `reward_profiles`

Columns:

- `id`
- `fan_name` unique text
- `points`
- `completed_detours`
- `report_reputation`
- `live_reports_submitted`
- `live_reports_verified`
- `created_at`
- `updated_at`

Purpose:

- persistent reward and reporting reputation state for each fan display name

### 6.4 `crowd_reports`

Columns:

- `id`
- `gate_id`
- `author_name`
- `message`
- `crowd_level`
- `latitude`
- `longitude`
- `status`
- `verification_count`
- `verified_at`
- `reputation_awarded`
- `created_at`
- `updated_at`

Purpose:

- stores crowdsourced event observations tied to a gate and location

### 6.5 `crowd_report_votes`

Columns:

- `id`
- `report_id`
- `fan_name`
- `latitude`
- `longitude`
- `created_at`

Constraint:

- unique on `(report_id, fan_name)`

Purpose:

- records which fans verified a report and prevents duplicate verification by the same fan

## 7. Seed Data

Seeding is implemented in [`apps/api/src/services/seedService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/seedService.js).

On first run the API inserts:

- 4 gates
  - `gate-1` North Stand
  - `gate-2` East Stand
  - `gate-3` South Stand
  - `gate-4` West Stand
- 1 organizer update from `Venue Ops`

Seed coordinates are around Mumbai. The UI and sample messaging also imply an India-focused demo context.

## 8. API Layer

### 8.1 Express application

Defined in [`apps/api/src/app.js`](/abs/path/C:/StadiumFlow/apps/api/src/app.js).

Middleware:

- `cors({ origin: env.clientOrigin })`
- `express.json()`

Registered routes:

- `/health`
- `/api/gates`
- `/api/reports`
- `/api/updates`
- `/api/rewards`

### 8.2 Error handling style

The codebase currently uses controller-local `try/catch` blocks. There is no centralized Express error middleware.

Effects:

- responses are simple and consistent enough for the prototype
- stack traces are not exposed to clients
- error classification is coarse

## 9. API Reference

All response examples below describe the shape returned by the current code.

### 9.1 Health

#### `GET /health`

Response:

```json
{ "ok": true }
```

### 9.2 Gates API

Implemented by:

- routes: [`apps/api/src/routes/gateRoutes.js`](/abs/path/C:/StadiumFlow/apps/api/src/routes/gateRoutes.js)
- controller: [`apps/api/src/controllers/gateController.js`](/abs/path/C:/StadiumFlow/apps/api/src/controllers/gateController.js)

#### `GET /api/gates`

Returns all gates ordered by:

1. `display_order`
2. `gate_name`

Response:

```json
{
  "gates": [
    {
      "id": "1",
      "gateId": "gate-1",
      "gateName": "Gate 1",
      "displayOrder": 1,
      "visible": true,
      "zoneLabel": "North Stand",
      "latitude": 19.0731,
      "longitude": 72.8782,
      "serviceRatePerMinute": 10,
      "queueLength": 200,
      "liveCrowdScore": 45,
      "directionHint": "Closest to the metro drop-off."
    }
  ]
}
```

#### `GET /api/gates/recommendation?latitude=...&longitude=...`

Required query params:

- `latitude`
- `longitude`

Behavior:

- only visible gates are considered
- each visible gate is scored
- recommended gate is the one with the smallest `totalMinutes`
- API also returns whether fan consent is needed before claiming detour points

Response shape:

```json
{
  "matchId": "live-match",
  "userLocation": {
    "latitude": 19.0728,
    "longitude": 72.8791
  },
  "routing": {
    "summary": "Gate 1 is 3 minutes away but has a 25 minute wait. Gate 3 is a 7 minute walk with a 1 minute wait. Proceed to Gate 3 to save 20 minutes.",
    "savedMinutes": 20,
    "recommendedGate": {
      "gateId": "gate-3",
      "gateName": "Gate 3",
      "latitude": 19.0711,
      "longitude": 72.8829,
      "walkingMinutes": 7,
      "walkingDistanceMeters": 560,
      "queueMinutes": 1,
      "totalMinutes": 8,
      "queueLength": 6,
      "status": "optimal",
      "directionHint": "Use the east concourse beside the practice nets.",
      "routeCoordinates": [
        { "latitude": 19.0728, "longitude": 72.8791 }
      ]
    },
    "alternatives": []
  },
  "needsConsentForLongerWalk": true,
  "detourIncentive": {
    "points": 40,
    "foodDiscountPercent": 10,
    "temporaryStreamAccess": false
  }
}
```

Notes:

- `matchId` is currently a static placeholder: `"live-match"`
- `needsConsentForLongerWalk` is `true` when the recommended gate is not the nearest walking gate and saves at least 5 minutes

#### `POST /api/gates`

Creates a gate.

Expected body fields:

- `gateId`
- `gateName`
- `displayOrder`
- `visible`
- `zoneLabel`
- `latitude`
- `longitude`
- `serviceRatePerMinute`
- `queueLength`
- `liveCrowdScore`
- `directionHint`

Observations:

- validation is minimal
- duplicate `gateId` fails because of the database uniqueness constraint

#### `PUT /api/gates/:gateId`

Updates an existing gate by `gate_id`.

Updatable fields:

- `gateName`
- `displayOrder`
- `visible`
- `zoneLabel`
- `latitude`
- `longitude`
- `serviceRatePerMinute`
- `queueLength`
- `liveCrowdScore`
- `directionHint`

### 9.3 Reports API

Implemented by:

- routes: [`apps/api/src/routes/reportRoutes.js`](/abs/path/C:/StadiumFlow/apps/api/src/routes/reportRoutes.js)
- controller: [`apps/api/src/controllers/reportController.js`](/abs/path/C:/StadiumFlow/apps/api/src/controllers/reportController.js)
- service: [`apps/api/src/services/crowdReportService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/crowdReportService.js)

#### `GET /api/reports`

Optional query params:

- `gateId`
- `latitude`
- `longitude`

Behavior:

- returns up to 30 reports ordered by latest first
- if `gateId` is provided, filters by gate
- if `latitude` and `longitude` are provided, filters to reports within `REPORT_RADIUS_METERS * 2`

#### `GET /api/reports/live`

Returns a live crowd-state bundle:

- `activeReports`
- `activeSnapshots`
- `gateSummaries`

`gateSummaries` includes:

- `gateId`
- `pendingReports`
- `verifiedReports`
- `lastReportAt`
- `queueLength`
- `liveCrowdScore`

#### `POST /api/reports`

Creates a new crowd report.

Required body fields:

- `gateId`
- `fanName`
- `message`
- `crowdLevel`
- `latitude`
- `longitude`

Behavior:

- verifies the gate exists
- creates a reward profile for the fan if one does not already exist
- inserts the report as `pending`
- sets `verification_count = 1` immediately because the author's own vote is recorded
- records the author's vote in `crowd_report_votes`
- increments `live_reports_submitted`
- caches the report snapshot in memory

Returned fields:

- `id`
- `gateId`
- `authorName`
- `message`
- `crowdLevel`
- `latitude`
- `longitude`
- `status`
- `verificationCount`
- `createdAt`
- `verifiedAt`

#### `POST /api/reports/:reportId/verify`

Verifies an existing crowd report.

Required body fields:

- `fanName`
- `latitude`
- `longitude`

Rules:

- the report must exist
- the verifying fan must be within `REPORT_RADIUS_METERS`
- a fan cannot verify the same report twice
- once vote count reaches `REPORT_VERIFICATION_THRESHOLD`, the report becomes `verified`

When a report becomes verified, the backend also:

1. marks the report snapshot verified
2. applies pressure to the related gate
3. creates a system update
4. awards reward points and reputation

### 9.4 Updates API

Implemented by:

- routes: [`apps/api/src/routes/updateRoutes.js`](/abs/path/C:/StadiumFlow/apps/api/src/routes/updateRoutes.js)
- controller: [`apps/api/src/controllers/updateController.js`](/abs/path/C:/StadiumFlow/apps/api/src/controllers/updateController.js)

#### `GET /api/updates`

Optional query param:

- `authorType`

Behavior:

- returns up to 50 updates ordered by latest first
- can filter by `authorType`

#### `POST /api/updates`

Required body fields:

- `authorType`
- `authorName`
- `message`

Optional fields:

- `priority`, default `"normal"`
- `context`, default `"operations"`

### 9.5 Rewards API

Implemented by:

- routes: [`apps/api/src/routes/rewardRoutes.js`](/abs/path/C:/StadiumFlow/apps/api/src/routes/rewardRoutes.js)
- controller: [`apps/api/src/controllers/rewardController.js`](/abs/path/C:/StadiumFlow/apps/api/src/controllers/rewardController.js)
- service: [`apps/api/src/services/rewardService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/rewardService.js)

#### `GET /api/rewards/profile?fanName=...`

Required query param:

- `fanName`

Behavior:

- returns the reward profile
- creates the profile first if it does not exist

Response fields:

- `fanName`
- `points`
- `completedDetours`
- `reportReputation`
- `liveReportsSubmitted`
- `liveReportsVerified`
- `availableDiscounts`
- `nextDiscountAt`

#### `POST /api/rewards/detour-points`

Required body fields:

- `fanName`
- `gateName`
- `matchId`

Behavior:

- awards 40 points
- increments `completed_detours`

Important limitation:

- backend does not verify actual gate arrival
- `gateName` and `matchId` are accepted for messaging but are not used in reward logic

#### `POST /api/rewards/redeem-food`

Required body field:

- `fanName`

Behavior:

- requires at least 200 points
- deducts 200 points

Constants:

- detour award: `40`
- discount threshold: `200`

## 10. Routing Logic

Implemented in [`apps/api/src/services/routingService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/routingService.js).

### 10.1 Queue-time estimation

Function:

`estimateQueueMinutes(queueLength, serviceRatePerMinute, liveCrowdScore)`

Logic:

- reduces effective service rate based on crowd score
- enforces a minimum service rate of `1`
- rounds queue time to whole minutes

Formula:

`adjustedRate = max(serviceRatePerMinute - liveCrowdScore * 0.05, 1)`

`queueMinutes = round(queueLength / adjustedRate)`

### 10.2 Walking-route retrieval

The backend uses [`apps/api/src/services/osrmService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/osrmService.js).

External endpoint:

- `https://router.project-osrm.org/route/v1/foot/...`

Requested options:

- `overview=full`
- `geometries=geojson`
- `steps=false`

Returned values:

- distance in meters
- duration in seconds
- decoded route coordinates

### 10.3 Fallback routing

If OSRM fails, the API falls back to:

- haversine straight-line distance
- a fixed walking speed assumption of `4.8 km/h`
- a 2-point line from origin to gate

This keeps the system usable even if OSRM is unavailable.

### 10.4 Gate status classification

`statusFor(totalMinutes)` returns:

- `optimal` if `<= 8`
- `steady` if `<= 15`
- `congested` otherwise

### 10.5 Recommendation payload

The routing service returns:

- `summary`
- `savedMinutes`
- `recommendedGate`
- `alternatives`

The controller adds:

- `matchId`
- `userLocation`
- `needsConsentForLongerWalk`
- `detourIncentive`

## 11. Crowd-Report Verification Model

The verification system is implemented mainly in [`apps/api/src/services/crowdReportService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/crowdReportService.js) and [`apps/api/src/services/reportCacheService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/reportCacheService.js).

### 11.1 Pending versus verified reports

Every new report starts as:

- `status = "pending"`
- `verification_count = 1`

The first count comes from the author's own submission vote.

### 11.2 Distance gating

Verification requires physical proximity. The backend computes the verifying fan's distance from the report location using haversine distance.

Default threshold:

- `160 meters`

### 11.3 Verification threshold

Default threshold:

- `3`

That means one author vote plus two additional nearby verifications will typically verify the report.

### 11.4 Snapshot cache

The backend maintains an in-memory map of recent report snapshots. This cache:

- expires entries after `REPORT_WINDOW_MINUTES`
- remembers active voters
- helps serve a recent live state

It does not replace the database. It is a temporary live-view layer.

### 11.5 Gate pressure application

When a report becomes verified, the backend applies a crowd profile to the related gate.

Current crowd profiles:

- `low` => queue `10`, score `8`
- `medium` => queue `35`, score `24`
- `high` => queue `70`, score `48`
- `critical` => queue `120`, score `72`

Behavior:

- queue length becomes `max(currentQueue, profile.queueDelta)`
- crowd score becomes `max(currentScore, profile.scoreDelta)`

This means verified pressure can only push values upward to at least the configured profile minimum. It does not decay automatically.

### 11.6 System-generated updates

Once a report is verified, the backend writes an organizer-style update like:

- `Gate X crowd level verified as high. Routing has been updated for nearby fans.`

These updates appear in the shared feed.

## 12. Reward System

Implemented in [`apps/api/src/services/rewardService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/rewardService.js).

### 12.1 Reward profile creation

Profiles are created lazily when:

- a fan asks for their reward profile
- a fan submits a crowd report
- a fan verifies a crowd report
- a fan is granted detour points

The profile key is `fan_name`, which is just the user-supplied display name.

### 12.2 Detour rewards

Constants:

- `DETOUR_POINTS = 40`

Effect:

- add 40 points
- increment completed detours

### 12.3 Report verification rewards

Once a report becomes verified:

- original reporter gets:
  - `+30 points`
  - `+2 report_reputation`
  - `+1 live_reports_verified`
- each other unique verifier gets:
  - `+10 points`
  - `+1 report_reputation`

The backend prevents duplicate payout using `reputation_awarded`.

### 12.4 Food discount redemption

Constants:

- `DISCOUNT_THRESHOLD = 200`

When redeemed:

- subtract 200 points
- no coupon code or external voucher is generated

`availableDiscounts` is derived as:

`floor(points / 200)`

## 13. Frontend Architecture

### 13.1 Shared types

Defined in [`apps/web/lib/types.ts`](/abs/path/C:/StadiumFlow/apps/web/lib/types.ts).

Important frontend types:

- `GateRecord`
- `CrowdReport`
- `LiveCrowdState`
- `GateRecommendation`
- `RoutingResponse`
- `FeedUpdate`
- `UserRewardProfile`
- `RecommendationPayload`

### 13.2 Client API helpers

Defined in [`apps/web/lib/api.ts`](/abs/path/C:/StadiumFlow/apps/web/lib/api.ts).

Responsibilities:

- centralizes fetch calls
- uses `cache: "no-store"` for live endpoints
- converts non-2xx responses into thrown errors using backend `message` fields when available
- provides typed helper functions for each API domain

## 14. Frontend Routes And Pages

### 14.1 `/`

Defined in [`apps/web/app/page.tsx`](/abs/path/C:/StadiumFlow/apps/web/app/page.tsx).

Purpose:

- landing page
- entry point to fan and organizer dashboards
- communicates current product framing

### 14.2 `/fan`

Defined by:

- page wrapper: [`apps/web/app/fan/page.tsx`](/abs/path/C:/StadiumFlow/apps/web/app/fan/page.tsx)
- main component: [`apps/web/components/FanDashboard.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/FanDashboard.tsx)

### 14.3 `/organizer`

Defined by:

- page wrapper: [`apps/web/app/organizer/page.tsx`](/abs/path/C:/StadiumFlow/apps/web/app/organizer/page.tsx)
- main component: [`apps/web/components/OrganizerDashboard.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/OrganizerDashboard.tsx)

## 15. Fan Dashboard Behavior

### 15.1 Initialization

When mounted, the fan dashboard:

- restores `fan-name` from `localStorage`
- fetches updates, reward profile, gates, and live crowd state
- requests geolocation
- fetches a routing recommendation once location is available

### 15.2 Polling

Refresh interval:

- every `15 seconds`

Refreshed bundle:

- updates
- reward profile
- gates
- live crowd state
- recommendation if location is available

### 15.3 Local state

The fan dashboard maintains:

- display name
- reward profile
- live updates
- gate list
- live crowd snapshot
- selected gate
- current recommendation
- user location
- detour consent toggle
- report draft text
- report target gate
- selected report crowd level

### 15.4 Geolocation failure handling

If geolocation fails or is blocked:

- the page still loads
- gate data still appears
- route scoring is unavailable until location is available
- a status message explains the limitation

### 15.5 Map behavior

Implemented by [`apps/web/components/StadiumMap.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/StadiumMap.tsx).

Features:

- Leaflet map
- OpenStreetMap tiles
- fan marker
- gate markers
- selected route polyline if route coordinates exist
- route fit-to-bounds behavior
- click-to-select gate

Marker semantics:

- first gate in the provided list is treated as the "best" gate
- selected gate gets a visual selected state

### 15.6 Recommendation panel

Implemented by [`apps/web/components/GateRecommendationPanel.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/GateRecommendationPanel.tsx).

Displays:

- recommendation summary
- walk distance and minutes
- queue wait
- total minutes
- saved minutes
- route alternatives
- gate health badge based on status

### 15.7 Crowd reporting

The fan can:

- choose a visible gate
- choose a crowd level
- enter a text description
- submit the report using current GPS coordinates

### 15.8 Crowd verification

The fan can verify pending nearby reports. The UI currently shows `3` as the target confirmation count in the card display, which matches the default backend threshold but is not dynamically sourced from environment settings.

### 15.9 Rewards UI

The fan profile shows:

- total points
- trust score
- available food perks
- reports filed
- reports proven
- detours helped

The fan can:

- claim detour points
- redeem food discounts

Important product nuance:

- detour point claiming is a frontend-triggered action and is not tied to gate scanning or location validation

## 16. Organizer Dashboard Behavior

### 16.1 Initialization and polling

The organizer dashboard loads:

- gates
- updates
- live crowd state

Polling interval:

- every `10 seconds`

### 16.2 Top-level organizer features

The organizer page includes:

- live metrics
- charts
- command center
- privacy studio
- gate placement map
- live fan-report feed
- gate list and gate editor
- organizer update composer
- shared timeline

### 16.3 Gate management

Gate editing is managed directly from [`apps/web/components/OrganizerDashboard.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/OrganizerDashboard.tsx).

Editable fields:

- gate code for new gates only
- gate name
- display order
- zone label
- latitude
- longitude
- service rate per minute
- queue length
- crowd score
- visibility
- direction hint

The organizer can:

- select an existing gate
- edit its fields
- create a new gate
- click the map to set coordinates
- drag the selected marker to reposition it

### 16.4 Organizer map

Implemented by [`apps/web/components/OrganizerMap.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/OrganizerMap.tsx).

Features:

- Leaflet map
- draggable marker for selected gate
- click anywhere to set coordinates
- draft marker for a new gate
- auto-fit bounds around current markers

### 16.5 Organizer update publishing

The organizer can post updates with:

- `context`: operations, entry, match, food
- `priority`: important or normal
- fixed `authorType`: organizer
- fixed `authorName`: Organizer Desk

### 16.6 Live fan-report visibility

The organizer can see recent active reports and whether they are:

- pending
- verified

This is read-only in the current UI. Organizers do not manually verify reports through a dedicated admin control.

## 17. Organizer Command Center

Implemented by [`apps/web/components/OrganizerCommandCenter.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/OrganizerCommandCenter.tsx).

This is a UI simulation layer for operational control. It does not directly change gate records or route scoring.

Features:

- predefined sectors
- predefined corridors
- draggable "Barricade" token
- corridor status display
- operator action log
- sector-specific alert drafting
- fan-facing reroute copy

Behavior:

- dropping barricades changes local corridor state
- clicking a sector loads an alert template
- pressing "Blast sector alert" publishes an organizer update through the API

Contexts used by sectors:

- `entry`
- `food`
- `operations`
- `match`

## 18. Crowd Privacy Studio

Implemented by [`apps/web/components/CrowdPrivacyStudio.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/CrowdPrivacyStudio.tsx).

This is one of the more advanced parts of the frontend.

### 18.1 Goal

Let organizers blur faces in crowd media on-device before saving or sharing it.

### 18.2 Modes

- photo upload mode
- live camera mode
- manual masking mode

### 18.3 Detection strategy

Automatic face detection attempts, in order:

1. browser `FaceDetector` API
2. OpenCV.js Haar cascade fallback

### 18.4 OpenCV loading

The component:

- loads `https://docs.opencv.org/4.x/opencv.js`
- downloads the cascade XML from GitHub raw content
- mounts the cascade into OpenCV's virtual filesystem
- initializes a classifier

### 18.5 Rendering strategy

Blurring is applied on a canvas:

- source frame is drawn
- each detected or manual region is pixelated and blurred
- if OpenCV is ready, an additional Gaussian blur pass is attempted

### 18.6 Manual masking

When manual mode is on:

- pointer down records start point
- pointer up creates a blur rectangle
- boxes can be removed individually

### 18.7 Export

The masked frame can be exported as a PNG using `canvas.toDataURL`.

### 18.8 Operational caveats

- browser support varies for `FaceDetector`
- camera access requires user permission
- OpenCV and the cascade load from external URLs
- no server-side processing exists for privacy masking

## 19. Styling And UX Layer

### 19.1 Global styling

Primary styles live in:

- [`apps/web/app/globals.css`](/abs/path/C:/StadiumFlow/apps/web/app/globals.css)
- inline critical styles in [`apps/web/app/layout.tsx`](/abs/path/C:/StadiumFlow/apps/web/app/layout.tsx)

Visual direction:

- warm paper-toned background
- green and rust accent colors
- rounded high-card layout
- dashboard-oriented information density

### 19.2 Metadata

Declared in [`apps/web/app/layout.tsx`](/abs/path/C:/StadiumFlow/apps/web/app/layout.tsx):

- title: `Stadium Flow Advisory`
- description: `Mathematical crowd routing for stadium entry and live match advisories.`

## 20. External Dependencies And Integrations

### 20.1 OSRM

Used for walking-route calculation.

Risk:

- public shared service
- no API key
- no retry or caching layer

### 20.2 OpenStreetMap tiles

Used by both Leaflet maps.

### 20.3 Browser geolocation

Used by the fan dashboard for live routing and crowd report verification.

### 20.4 Browser camera and media APIs

Used by the privacy studio.

### 20.5 Face detection and OpenCV

Used by the privacy studio.

## 21. Deployment

### 21.1 Render Blueprint

Defined in [`render.yaml`](/abs/path/C:/StadiumFlow/render.yaml).

Service characteristics:

- service name: `stadiumflow-api`
- runtime: `node`
- plan: `starter`
- root directory: `apps/api`
- build command: `npm install`
- start command: `npm start`
- health check: `/health`

Environment values set in blueprint:

- `SQLITE_PATH=/opt/render/project/src/data/stadium-flow.sqlite`
- `REPORT_VERIFICATION_THRESHOLD=3`
- `REPORT_RADIUS_METERS=160`
- `REPORT_WINDOW_MINUTES=8`

Required manual environment variable:

- `CLIENT_ORIGIN`

### 21.2 Persistent disk

Render disk config:

- mount path: `/opt/render/project/src/data`
- size: `1 GB`

This is required because the API persists SQLite to disk.

## 22. Security And Product Gaps

These are important because they affect how the documentation should be interpreted.

### 22.1 No authentication

There is:

- no login system
- no session handling
- no authorization checks
- no organizer-only server protection

Any client that can reach the API can:

- create or update gates
- create organizer updates
- award detour points
- redeem rewards for any `fanName`

### 22.2 No abuse prevention

There is:

- no rate limiting
- no anti-spam controls
- no CSRF protection model
- no replay protection for detour claiming

### 22.3 Trust model is display-name based

Reward identity is keyed only by `fan_name`.

Consequences:

- name collisions are possible
- impersonation is trivial
- rewards are not bound to user accounts

### 22.4 Limited validation

The backend checks for required fields in several places, but it does not use a schema-validation library. Numeric bounds and enum enforcement are partly implicit rather than explicit.

## 23. Performance Characteristics

Current implementation is acceptable for a prototype, but there are constraints:

- full DB export occurs on every write
- frontend polling is simple fixed-interval polling
- no websocket or SSE live updates
- no pagination on updates beyond server-side `LIMIT`
- no caching of OSRM responses

## 24. Known Repository Notes

- `contracts/` exists but is empty in the current repository state.
- `README.md` and `DOCUMENTATION.md` existed previously but were more generic than the actual code.
- There are no automated tests, migration files, or database snapshots documented as part of a formal release process.

## 25. Suggested Improvements

### 25.1 Backend

- add request-schema validation
- add auth and RBAC
- add route recommendation caching
- add event-based detour confirmation
- add decay logic for stale crowd pressure
- add centralized error middleware

### 25.2 Frontend

- replace polling with websocket or SSE updates
- surface backend thresholds dynamically in UI
- add explicit loading/error states per panel
- add organizer controls for reviewing or moderating reports

### 25.3 Data and operations

- migrate from file-export persistence to a real SQLite server process or Postgres for multi-instance deployment
- add analytics and audit logging
- add tests for routing, report verification, and rewards

## 26. Quick File Guide

High-value files to read first:

- [`README.md`](/abs/path/C:/StadiumFlow/README.md)
- [`apps/api/src/server.js`](/abs/path/C:/StadiumFlow/apps/api/src/server.js)
- [`apps/api/src/config/database.js`](/abs/path/C:/StadiumFlow/apps/api/src/config/database.js)
- [`apps/api/src/services/routingService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/routingService.js)
- [`apps/api/src/services/crowdReportService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/crowdReportService.js)
- [`apps/api/src/services/rewardService.js`](/abs/path/C:/StadiumFlow/apps/api/src/services/rewardService.js)
- [`apps/web/components/FanDashboard.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/FanDashboard.tsx)
- [`apps/web/components/OrganizerDashboard.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/OrganizerDashboard.tsx)
- [`apps/web/components/CrowdPrivacyStudio.tsx`](/abs/path/C:/StadiumFlow/apps/web/components/CrowdPrivacyStudio.tsx)

## 27. Final Summary

This repository is a solid full-stack prototype for live stadium entry management. Its strongest implemented areas are:

- end-to-end gate routing
- fan reporting and verification loop
- organizer gate control
- visual dashboards
- privacy masking UX

Its weakest production-readiness areas are:

- authentication
- abuse resistance
- testing
- durable multi-user operational guarantees

If you need deeper code walkthroughs beyond this document, the next most useful step would be module-by-module docs for the API services or a true OpenAPI spec for all endpoints.
