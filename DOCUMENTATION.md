# Stadium Flow Advisory Documentation

This document is the implementation-level reference for the current repository state. It describes the behavior that is actually present in the codebase as of this revision, including important limitations, edge cases, and mismatches that matter for anyone running or extending the project.

## 1. Project Overview

Stadium Flow Advisory is a stadium-entry routing prototype with two primary operating modes:

- a fan experience that recommends the fastest gate based on walking and queue time
- an organizer experience that manages gates, publishes alerts, and monitors live crowd signals

The core idea is that the nearest gate is not always the fastest gate. The backend ranks gates by total time, not proximity alone:

`totalMinutes = walkingMinutes + queueMinutes`

The system also adds a lightweight social trust loop:

- fans can file live crowd reports
- nearby fans can verify those reports
- verified reports affect gate congestion modeling
- verified reporting awards points and reporting reputation

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
|- package.json
`- package-lock.json
```

Notes:

- `contracts/` exists but is empty.
- The repository does not currently include `render.yaml` or `RENDER_API_DEPLOY.md`, even though older docs referenced them.

## 3. Applications

### 3.1 `apps/web`

This is a Next.js App Router application. It contains:

- the landing page
- the fan dashboard
- the organizer dashboard
- shared API helpers
- shared frontend types
- Leaflet maps
- organizer-only command center UI
- organizer-only privacy masking tool

### 3.2 `apps/api`

This is an Express API application. It contains:

- environment loading
- SQLite persistence through `sql.js`
- schema bootstrap logic
- starter seeding
- routing calculation
- crowd-report verification rules
- reward logic
- route handlers and controllers

## 4. Runtime Architecture

### 4.1 Frontend-to-backend flow

The frontend uses fetch-based helpers in `apps/web/lib/api.ts` to call the API directly. All live requests are made with `cache: "no-store"` so the UI always requests fresh data.

### 4.2 Backend startup flow

Defined in `apps/api/src/server.js`:

1. connect to the database
2. create tables if they do not exist
3. seed starter data if the database is empty
4. start Express on `env.port`

### 4.3 Persistence model

Persistence is implemented in `apps/api/src/config/database.js`.

The API uses `sql.js`, which means:

- SQLite runs in memory inside the Node process
- writes are persisted by exporting the database to a file after each mutation

Implications:

- easy local setup
- no external database server required
- every write rewrites the database file
- scaling characteristics are limited compared with a real multi-process DB setup
- production durability depends on a persistent filesystem

## 5. Configuration

### 5.1 Root workspace configuration

The root `package.json` uses npm workspaces:

- `apps/*`

Root scripts:

- `dev:web`
- `dev:api`
- `lint:web`
- `start:api`

### 5.2 API configuration

Environment loading is implemented in `apps/api/src/config/env.js`.

The API reads environment variables from:

- `apps/api/.env`

Supported variables:

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

Database path behavior:

- if `SQLITE_PATH` is unset, the API uses `apps/api/data/stadium-flow.sqlite`
- if `SQLITE_PATH` is set inside `apps/api/.env`, it should normally be `./data/stadium-flow.sqlite`

Observed repository detail:

- the repo currently contains both `apps/api/data/stadium-flow.sqlite`
- and `apps/api/apps/api/data/stadium-flow.sqlite`

That nested path is usually created by setting:

`SQLITE_PATH=./apps/api/data/stadium-flow.sqlite`

inside `apps/api/.env`, then running the API from the `apps/api` workspace directory.

### 5.3 Web configuration

The frontend uses:

- `NEXT_PUBLIC_API_BASE_URL`

Default:

- `http://localhost:4000/api`

## 6. Database Schema

Table creation is handled in `apps/api/src/config/database.js`.

### 6.1 `gates`

Columns:

- `id` integer primary key
- `gate_id` unique text code
- `gate_name` text display label
- `display_order` integer
- `visible` integer boolean
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

- organizer-managed source of truth for fan-visible and simulation-visible gates

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

- shared timeline for organizer-posted and system-generated updates

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

- persistent reward and reporting stats for each display name

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

- stores crowdsourced crowd-condition reports

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

- prevents duplicate verification by the same display name on the same report

## 7. Seed Data

Seeding is implemented in `apps/api/src/services/seedService.js`.

Inserted when the database is empty:

- 4 gates
- 1 organizer update

Starter gates:

- `gate-1` / `Gate 1` / `North Stand`
- `gate-2` / `Gate 2` / `East Stand`
- `gate-3` / `Gate 3` / `South Stand`
- `gate-4` / `Gate 4` / `West Stand`

Seed characteristics:

- all gates start visible
- gate queues and crowd scores are intentionally uneven to make routing interesting
- sample coordinates are clustered around Mumbai

Starter update:

- `Venue Ops` posts one important `operations` update announcing that the organizer dashboard is live

## 8. Express Application Layer

Defined in `apps/api/src/app.js`.

Middleware:

- `cors({ origin: env.clientOrigin })`
- `express.json()`

Routes:

- `/health`
- `/api/gates`
- `/api/reports`
- `/api/updates`
- `/api/rewards`

Error handling style:

- each controller uses local `try/catch`
- there is no centralized Express error middleware
- backend error messaging is prototype-level and not deeply classified

## 9. API Reference

This section documents what the current code returns and enforces.

### 9.1 `GET /health`

Response:

```json
{ "ok": true }
```

### 9.2 Gates API

Implemented by:

- `apps/api/src/routes/gateRoutes.js`
- `apps/api/src/controllers/gateController.js`

#### `GET /api/gates`

Behavior:

- returns all gates
- orders by `display_order`, then `gate_name`
- includes hidden gates

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

- validates only that both params parse to finite numbers
- loads only visible gates
- returns `404` if no visible gates exist
- computes walking time and queue time per gate
- selects the gate with the smallest total time
- returns the recommended gate plus alternatives

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

- `matchId` is currently a fixed placeholder string: `"live-match"`
- `needsConsentForLongerWalk` is `true` only when:
  - the recommended gate is not the nearest-walking gate
  - and `savedMinutes >= 5`
- `detourIncentive` is informational only; there is no proof-of-arrival enforcement

#### `POST /api/gates`

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

Behavior:

- minimal validation
- numeric fields are cast with `Number(...)`
- duplicate `gateId` fails through the DB unique constraint
- returns `400` on failure with a generic message

#### `PUT /api/gates/:gateId`

Behavior:

- updates an existing gate by `gate_id`
- `gate_id` itself is not editable through this endpoint
- returns `404` if the gate does not exist

Editable fields:

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

- `apps/api/src/routes/reportRoutes.js`
- `apps/api/src/controllers/reportController.js`
- `apps/api/src/services/crowdReportService.js`

#### `GET /api/reports`

Optional query params:

- `gateId`
- `latitude`
- `longitude`

Behavior:

- loads at most 30 reports ordered newest first
- filters by `gateId` if supplied
- if both `latitude` and `longitude` are present, filters to reports within `REPORT_RADIUS_METERS * 2`

Important nuance:

- the location filter is applied in memory after querying recent reports
- it is not a geospatial DB query

#### `GET /api/reports/live`

Returns a live bundle with:

- `activeReports`
- `activeSnapshots`
- `gateSummaries`

`gateSummaries` contains:

- `gateId`
- `pendingReports`
- `verifiedReports`
- `lastReportAt`
- `queueLength`
- `liveCrowdScore`

Purpose:

- this is the main fan and organizer dashboard live-state endpoint

#### `POST /api/reports`

Required body fields:

- `gateId`
- `fanName`
- `message`
- `crowdLevel`
- `latitude`
- `longitude`

Behavior:

- ensures the gate exists
- lazily creates a reward profile if needed
- inserts the report as `pending`
- sets `verification_count = 1` immediately
- records the author's own vote in `crowd_report_votes`
- increments `live_reports_submitted`
- stores a recent snapshot in memory

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

Required body fields:

- `fanName`
- `latitude`
- `longitude`

Rules:

- the report must exist
- the verifying fan must be within `REPORT_RADIUS_METERS`
- the same fan cannot verify twice
- verification is keyed by display name, not account identity
- once the vote count reaches `REPORT_VERIFICATION_THRESHOLD`, the report becomes `verified`

When a report becomes verified, the backend:

1. marks the in-memory snapshot verified
2. updates the gate queue and crowd score
3. creates a system update in the feed
4. awards reputation and reward points

### 9.4 Updates API

Implemented by:

- `apps/api/src/routes/updateRoutes.js`
- `apps/api/src/controllers/updateController.js`

#### `GET /api/updates`

Optional query param:

- `authorType`

Behavior:

- returns at most 50 updates
- newest first
- can filter by `authorType`

#### `POST /api/updates`

Required:

- `authorType`
- `authorName`
- `message`

Optional:

- `priority`, default `"normal"`
- `context`, default `"operations"`

Behavior:

- used by organizer dashboard and command center
- also matches the shape used by system-created updates

### 9.5 Rewards API

Implemented by:

- `apps/api/src/routes/rewardRoutes.js`
- `apps/api/src/controllers/rewardController.js`
- `apps/api/src/services/rewardService.js`

#### `GET /api/rewards/profile?fanName=...`

Required query param:

- `fanName`

Behavior:

- returns the reward profile
- creates it if it does not exist yet

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
- increments completed detours
- returns a success message plus the updated profile

Important limitation:

- `gateName` and `matchId` are required for request shape and messaging only
- backend reward logic does not validate that the fan actually reached the gate

#### `POST /api/rewards/redeem-food`

Required:

- `fanName`

Behavior:

- requires at least 200 points
- subtracts 200 points
- returns a message plus the updated profile

Important limitation:

- no coupon code, voucher object, or third-party redemption integration is created

## 10. Routing Logic

Routing is implemented in `apps/api/src/services/routingService.js`.

### 10.1 Queue estimation

Function:

`estimateQueueMinutes(queueLength, serviceRatePerMinute, liveCrowdScore)`

Formula:

`adjustedRate = max(serviceRatePerMinute - liveCrowdScore * 0.05, 1)`

`queueMinutes = round(queueLength / adjustedRate)`

Effects:

- higher crowd score reduces effective throughput
- throughput never drops below `1`
- queue results are rounded to whole minutes

### 10.2 Walking route source

Walking routes come from `apps/api/src/services/osrmService.js`.

External endpoint:

- `https://router.project-osrm.org/route/v1/foot/...`

Requested options:

- `overview=full`
- `geometries=geojson`
- `steps=false`

Returned route data:

- distance in meters
- duration in seconds
- route coordinates decoded into `{ latitude, longitude }` objects

### 10.3 Fallback routing

If OSRM fails for any reason:

- the backend estimates straight-line distance with haversine math
- assumes walking speed of `4.8 km/h`
- returns a 2-point line from origin to destination

This keeps recommendations available even when OSRM is down or unreachable.

### 10.4 Gate status bands

Gate status is derived from total minutes:

- `optimal` if `<= 8`
- `steady` if `<= 15`
- `congested` otherwise

### 10.5 Recommendation payload structure

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

## 11. Crowd Reporting And Verification Model

Implemented mainly in:

- `apps/api/src/services/crowdReportService.js`
- `apps/api/src/services/reportCacheService.js`

### 11.1 Report lifecycle

Every new report starts as:

- `status = "pending"`
- `verification_count = 1`

The first count comes from the author's own vote.

### 11.2 Distance gating

Verification requires spatial proximity.

The backend computes distance with haversine math and rejects verifications farther than:

- `REPORT_RADIUS_METERS`

Default:

- `160 meters`

### 11.3 Verification threshold

Default threshold:

- `3`

In the default setup, that usually means:

- 1 author vote
- 2 additional nearby fans

### 11.4 Snapshot cache

The backend keeps a recent in-memory snapshot map for live crowd display.

The cache:

- stores recent report snapshots
- tracks voters in a `Set`
- expires entries after `REPORT_WINDOW_MINUTES`
- supplements the database for live dashboards

It does not replace the database and is lost on process restart.

### 11.5 Gate pressure application

When a report becomes verified, the backend applies a crowd profile:

- `low` => queue `10`, score `8`
- `medium` => queue `35`, score `24`
- `high` => queue `70`, score `48`
- `critical` => queue `120`, score `72`

Behavior:

- `queue_length = max(currentQueue, profile.queueDelta)`
- `live_crowd_score = max(currentScore, profile.scoreDelta)`

Implication:

- verified crowd pressure can only push a gate upward to at least that floor
- there is no automatic decay back down over time

### 11.6 System updates on verification

Once verified, the backend inserts an update like:

- `Gate X crowd level verified as high. Routing has been updated for nearby fans.`

These appear in the same updates feed used by organizers.

## 12. Reward Model

Implemented in `apps/api/src/services/rewardService.js`.

### 12.1 Reward identity model

Profiles are keyed only by:

- `fan_name`

There is no user account, login, or device identity.

### 12.2 Profile creation

Profiles are created lazily when:

- a fan requests their profile
- a fan submits a report
- a fan verifies a report
- a fan claims detour points

### 12.3 Detour rewards

Constant:

- `DETOUR_POINTS = 40`

Effect:

- `+40` points
- `+1` completed detour

### 12.4 Verified report rewards

When a report becomes verified:

- original reporter gets:
  - `+30` points
  - `+2` report reputation
  - `+1` live reports verified
- each additional verifier gets:
  - `+10` points
  - `+1` report reputation

Duplicate payout prevention:

- `crowd_reports.reputation_awarded` prevents the verification rewards from being paid more than once

### 12.5 Food discount redemption

Constant:

- `DISCOUNT_THRESHOLD = 200`

Behavior:

- requires at least 200 points
- subtracts 200 points
- leaves reward fulfillment abstract

Derived frontend values:

- `availableDiscounts = floor(points / 200)`
- `nextDiscountAt = 200`

## 13. Frontend Architecture

### 13.1 Routes

- `/` landing page
- `/fan` fan dashboard
- `/organizer` organizer dashboard

### 13.2 Shared types

Defined in `apps/web/lib/types.ts`.

Important types:

- `GateRecord`
- `CrowdReport`
- `LiveCrowdState`
- `GateRecommendation`
- `RoutingResponse`
- `FeedUpdate`
- `UserRewardProfile`
- `RecommendationPayload`

### 13.3 Shared API client

Defined in `apps/web/lib/api.ts`.

Behavior:

- centralizes all fetch calls
- throws a helpful "API unreachable" error if fetch itself fails
- parses backend error messages when available
- uses `cache: "no-store"` for live reads

## 14. Landing Page

Defined in `apps/web/app/page.tsx`.

Purpose:

- explain the product at a high level
- provide direct links to the fan and organizer dashboards

Messaging focus:

- fan routing
- organizer gate control
- simulated crowd mode

## 15. Fan Dashboard

Implemented in `apps/web/components/FanDashboard.tsx`.

### 15.1 Initialization

On mount, the fan dashboard:

- restores `fan-name` from `localStorage`
- fetches updates
- fetches reward profile
- fetches gates
- fetches live crowd state
- requests geolocation
- requests a recommendation once location is available

### 15.2 Polling

Refresh interval:

- every `15 seconds`

Refreshed data:

- updates
- reward profile
- gates
- live crowd state
- recommendation when location is available

### 15.3 Local state

The component maintains:

- `fanName`
- `profile`
- `updates`
- `gates`
- `liveState`
- `recommendation`
- `userLocation`
- `selectedGateId`
- `loadingMessage`
- `locationState`
- `feedback`
- `acceptedDetour`
- `reportMessage`
- `reportGateId`
- `reportLevel`

### 15.4 Location behavior

If geolocation succeeds:

- the app computes route recommendations
- the user sees a location marker and route polyline

If geolocation fails or is blocked:

- the dashboard still loads
- organizer-defined gates still render
- route scoring is unavailable
- verification and report submission become limited by lack of location

### 15.5 Fan profile card

Shows:

- total points
- trust score
- available food perks
- reports filed
- reports proven
- detours helped

Also includes:

- display-name input
- detour-points action
- food-redemption action

### 15.6 Queue and crowd pulse cards

For each visible gate the dashboard shows:

- gate name
- zone label
- queue length
- crowd score
- verified report count
- pending report count
- last signal timestamp

The state label changes between:

- `Steady`
- `Watching`
- `Verified pressure`

### 15.7 Charts

Two bar charts are shown:

- Queue Pressure by Gate
- Crowd Signal Confidence

These are visual summaries only; they are not separate API-backed features.

### 15.8 Live route map

Implemented in `apps/web/components/StadiumMap.tsx`.

Features:

- Leaflet map
- OpenStreetMap tiles
- fan location marker
- gate markers
- popup metrics per gate
- route polyline for the selected gate when coordinates exist
- fit-to-bounds on route or markers
- click-to-select gate

Marker semantics:

- the first gate in the supplied list is treated as the "best gate"
- selected gate styling is separate from best-gate styling

### 15.9 Recommendation panel

Implemented in `apps/web/components/GateRecommendationPanel.tsx`.

Displays:

- recommendation summary
- walking minutes
- walking distance
- queue minutes
- total minutes
- saved minutes
- direction hint
- alternative gates
- status badge per gate

### 15.10 Detour consent UI

If the recommended gate is not the nearest gate and saves at least 5 minutes:

- the dashboard shows a detour-consent card
- the fan can explicitly accept the longer walk for points

Important limitation:

- acceptance is a frontend state only
- backend reward claiming is still user-triggered and not arrival-verified

### 15.11 Crowd report submission

The fan can:

- choose a visible gate
- choose a crowd level
- write a text report
- submit it using current location

Crowd levels exposed in the UI:

- `low`
- `medium`
- `high`
- `critical`

### 15.12 Crowd report verification

The fan can verify pending reports from the nearby-reports list.

Current UI behavior:

- shows up to 6 pending reports
- displays verification count as `x/3`

Important nuance:

- that visible denominator is hard-coded in the frontend
- it matches the default backend threshold, but it is not dynamically sourced from environment configuration

## 16. Organizer Dashboard

Implemented in `apps/web/components/OrganizerDashboard.tsx`.

### 16.1 Initialization and polling

On load it fetches:

- gates
- updates
- live crowd state

Polling interval:

- every `10 seconds`

### 16.2 Hero metrics

The organizer dashboard shows:

- total gate count
- total verified crowd signals
- total pending verifications

### 16.3 Gate map and coordinate editing

Implemented in `apps/web/components/OrganizerMap.tsx`.

Features:

- Leaflet map
- click map to set coordinates
- draggable marker for selected gate
- draft marker for new gate creation
- fit-to-bounds on current markers

Map interactions:

- clicking a gate marker selects it for editing
- dragging the selected marker updates the form coordinates
- clicking the map updates the selected or draft coordinates

### 16.4 Gate list and gate editor

The organizer can:

- select an existing gate
- create a new gate
- toggle visibility
- edit display order
- edit zone label
- edit lat/lng
- edit service rate
- edit queue length
- edit crowd score
- edit direction hint

Gate code rules:

- editable only for new gates
- locked for existing gates

### 16.5 Live fan-report visibility

The organizer sees recent active reports with:

- author name
- status
- report text
- gate id
- confirmation count
- crowd level

This view is read-only.

There is no manual moderator approval or organizer verification action.

### 16.6 Organizer update composer

Allows organizers to post updates with:

- context: `operations`, `entry`, `match`, `food`
- priority: `important`, `normal`
- message text

Fixed author identity in this UI:

- `authorType: "organizer"`
- `authorName: "Organizer Desk"`

### 16.7 Shared timeline

The organizer timeline displays:

- organizer-posted updates
- system-generated updates

The current component loads all updates, not just organizer-only updates.

## 17. Organizer Command Center

Implemented in `apps/web/components/OrganizerCommandCenter.tsx`.

This is a simulation-and-messaging tool, not a direct routing-engine control surface.

### 17.1 Purpose

Provide a fast manual-override UI so organizers can:

- mark corridor disruptions visually
- prepare sector-specific alert copy
- publish those alerts into the live updates feed

### 17.2 Visual model

The command center defines:

- 6 sectors
- 4 corridors
- a draggable `Barricade` token

Sectors:

- Sector 1
- Sector 2
- Sector 3
- Sector 4
- Club Ring
- Entry Plaza

Corridors:

- North Walk
- East Ramp
- South Ribbon
- West Link

### 17.3 Barricade behavior

Dragging a barricade onto a corridor:

- creates a local drop marker
- marks the corridor active
- logs a recent operator action

Removing a barricade:

- deletes the local drop marker
- reopens that path in the local UI model

### 17.4 Corridor status logic

Each corridor shows:

- `Open` when it has 0 barricades
- `Rerouted` when it has 1 barricade
- `Closed` when it has more than 1 barricade

### 17.5 Alert blast behavior

Selecting a sector:

- loads a predefined alert template
- sets the default context for that sector

Clicking `Blast sector alert`:

- sends the current draft through the real updates API
- uses author name `Command Center`
- uses priority `important`

Important limitation:

- this does not mutate gate records
- this does not change route scoring directly
- it only creates a feed update

## 18. Crowd Privacy Studio

Implemented in `apps/web/components/CrowdPrivacyStudio.tsx`.

This is one of the most feature-rich parts of the frontend.

### 18.1 Goal

Blur faces in crowd media entirely in the browser before export or sharing.

### 18.2 Supported modes

- uploaded crowd photo mode
- live camera mode
- manual mask drawing mode

### 18.3 Auto-detection strategy

Detection is attempted in this order:

1. browser `FaceDetector` API
2. OpenCV.js Haar cascade fallback

### 18.4 OpenCV runtime loading

The component dynamically loads:

- `https://docs.opencv.org/4.x/opencv.js`

Then downloads:

- `https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/haarcascade_frontalface_default.xml`

Then mounts the cascade into OpenCV's virtual filesystem and initializes a classifier.

### 18.5 Photo flow

When a photo is uploaded:

- the app creates an object URL
- clears previous masks
- attempts auto face detection
- preserves any manual boxes
- renders the blurred frame to a canvas

### 18.6 Live camera flow

When live camera mode is enabled:

- the browser requests camera access
- the stream is attached to a hidden video element
- every animation frame redraws the protected image
- every 10th frame attempts face detection
- auto and manual boxes are merged

### 18.7 Blur implementation

Canvas stage:

- original frame is drawn
- each region is first pixelated through downsample and upsample
- then blurred with canvas filters

If OpenCV is available:

- a Gaussian blur pass is also attempted on the masked regions

### 18.8 Manual masking

When manual mode is active:

- pointer down stores a start point
- pointer up creates a rectangular privacy box
- boxes smaller than 16 px in width or height are ignored
- each box can be removed individually by clicking it

### 18.9 Export

The masked frame can be downloaded as:

- `protected-crowd-<timestamp>.png`

Implementation:

- `canvas.toDataURL("image/png")`

### 18.10 Runtime caveats

- browser support for `FaceDetector` varies
- camera access depends on user permission
- OpenCV load depends on external network access
- cascade download depends on external network access
- there is no server-side masking path

## 19. Shared UI Infrastructure

### 19.1 App header

Implemented in `apps/web/components/AppHeader.tsx`.

Features:

- brand link to home
- dashboard navigation
- sign-out button on non-home pages

Sign-out behavior:

- removes `fan-name` from `localStorage`
- routes back to `/`

There is no real auth session to terminate.

### 19.2 Bar chart component

Implemented in `apps/web/components/LiveBarChart.tsx`.

Purpose:

- lightweight dashboard visualization

Behavior:

- auto-normalizes bar height against the largest current value
- supports tones `neutral`, `accent`, `alert`, and `cool`

### 19.3 Global styling

Defined primarily in:

- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`

Notable design direction:

- light paper-toned background
- green and rust accent palette
- rounded card-heavy dashboard style
- map-first layout for both fan and organizer views

### 19.4 Metadata

Declared in `apps/web/app/layout.tsx`:

- title: `Stadium Flow Advisory`
- description: `Mathematical crowd routing for stadium entry and live match advisories.`

## 20. External Dependencies And Network Touchpoints

### 20.1 OSRM

Used by the backend for walking routes.

Risks:

- public shared service
- no API key or private quota
- no caching layer
- no retry policy

### 20.2 OpenStreetMap tiles

Used by both frontend maps.

### 20.3 Browser geolocation

Required for:

- live routing
- crowd report submission with current location
- nearby report verification

### 20.4 Browser media APIs

Used by:

- live privacy camera mode

### 20.5 External OpenCV assets

Used by:

- privacy studio auto-detection fallback

## 21. Security And Trust Limitations

These are significant and should be treated as core product constraints, not footnotes.

### 21.1 No authentication

The repository currently has:

- no login
- no sessions
- no user accounts
- no role-based authorization

Consequences:

- anyone who can reach the API can modify gates
- anyone can publish organizer updates
- anyone can claim detour points for any name
- anyone can redeem points for any name

### 21.2 Display-name identity only

Reward identity is keyed only by `fan_name`.

Consequences:

- collisions are possible
- impersonation is easy
- rewards are not device-bound or account-bound

### 21.3 No abuse prevention

Missing controls:

- rate limiting
- spam throttling
- replay protection
- CSRF model
- moderation workflow

### 21.4 Minimal validation

The backend validates presence of several required fields, but it does not use a schema validation library.

Consequences:

- enum enforcement is loose
- bounds checking is limited
- malformed numeric data may still be accepted if `Number(...)` produces finite values

## 22. Performance And Operational Characteristics

Current constraints:

- the DB file is exported on every write
- dashboards use fixed polling rather than push updates
- no websocket or SSE transport exists
- no OSRM response cache exists
- live crowd calculations are simple and synchronous
- report filtering is small-scale and in-memory after recent-query retrieval

For a prototype this is acceptable. For a live venue system at scale it would need rework.

## 23. Known Implementation Quirks

### 23.1 Duplicate DB-path pattern in repo

The repository contains both:

- `apps/api/data/stadium-flow.sqlite`
- `apps/api/apps/api/data/stadium-flow.sqlite`

This likely came from two different `SQLITE_PATH` conventions being used during development.

### 23.2 Hard-coded verification target in fan UI

The fan dashboard renders pending reports as:

- `x/3 confirmations`

The backend threshold is configurable, but the frontend display is currently hard-coded to `3`.

### 23.3 Reward messaging is ahead of enforcement

The recommendation and reward UI talk about accepting a reroute and confirming arrival later, but the backend does not verify arrival at the recommended gate.

### 23.4 Command center is messaging-first

The command center looks like an operational control surface, but it currently publishes alerts only. It does not mutate routing inputs directly.

## 24. Local Development Guide

### 24.1 Install

From repo root:

```bash
npm install
```

### 24.2 Configure API

Create `apps/api/.env` with:

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

### 24.3 Configure web

Create `apps/web/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

### 24.4 Start services

API:

```bash
npm run dev:api
```

Web:

```bash
npm run dev:web
```

### 24.5 Default URLs

- frontend: `http://localhost:3000`
- API: `http://localhost:4000/api`
- health: `http://localhost:4000/health`

## 25. File Guide

Most important files for understanding the project:

- `apps/api/src/server.js`
- `apps/api/src/app.js`
- `apps/api/src/config/env.js`
- `apps/api/src/config/database.js`
- `apps/api/src/services/seedService.js`
- `apps/api/src/services/routingService.js`
- `apps/api/src/services/osrmService.js`
- `apps/api/src/services/crowdReportService.js`
- `apps/api/src/services/reportCacheService.js`
- `apps/api/src/services/rewardService.js`
- `apps/web/lib/api.ts`
- `apps/web/lib/types.ts`
- `apps/web/components/FanDashboard.tsx`
- `apps/web/components/StadiumMap.tsx`
- `apps/web/components/GateRecommendationPanel.tsx`
- `apps/web/components/OrganizerDashboard.tsx`
- `apps/web/components/OrganizerMap.tsx`
- `apps/web/components/OrganizerCommandCenter.tsx`
- `apps/web/components/CrowdPrivacyStudio.tsx`

## 26. Suggested Next Engineering Steps

### 26.1 Backend

- add schema-based request validation
- add auth and organizer authorization
- add structured error middleware
- add decay logic for stale crowd pressure
- add anti-abuse controls around reports and rewards
- add recommendation caching

### 26.2 Frontend

- source verification thresholds dynamically from the backend
- add better panel-specific loading and error states
- add moderator workflows for reports
- replace polling with websocket or SSE updates

### 26.3 Data and operations

- replace per-write DB export with a more scalable persistence strategy
- add tests for routing, verification, and rewards
- add CI
- decide whether `contracts/` will hold shared API schemas or remove it

## 27. Summary

The project already implements a surprising amount of end-to-end behavior for a prototype:

- live gate recommendation based on walking plus queue time
- gate administration
- fan crowd reporting and nearby verification
- routing impact from verified reports
- reward and detour tracking
- organizer alerts
- a privacy-focused browser masking tool

Its main readiness gaps are not feature completeness but operational trust:

- no authentication
- no abuse resistance
- no tests
- no production-grade deployment assets in the repo

For a demo, hackathon, or prototype showcase, the codebase is coherent and feature-rich. For real venue operations, the next work should focus on trust, validation, and operational hardening.
