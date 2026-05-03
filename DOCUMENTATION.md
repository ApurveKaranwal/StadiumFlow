# 📖 Stadium Flow Advisory - Full Documentation

This document provides a detailed technical breakdown of the Stadium Flow Advisory platform, its architecture, APIs, and data structures.

---

## 🏗️ Project Architecture

This project is structured as a monorepo containing two main applications:

- **`apps/web`**: A modern **Next.js** frontend application offering interfaces for both fans (attendees) and stadium organizers.
- **`apps/api`**: A robust **Express.js** API backend that handles routing logic, persists data using SQLite, manages live crowd updates, and powers the fan reward points system.

---

## ✨ Key Features

- **Live Gate Recommendations**: Recommends the optimal gate for a fan by calculating the combination of OSRM (Open Source Routing Machine) walking time and current queue delays.
- **Fan Dashboard (`/fan`)**: A user-centric view where fans can see their recommended gates, view the stadium map, report crowd levels, and earn/spend reward points.
- **Organizer Command Center (`/organizer`)**: A dashboard for stadium staff to manage gate names, adjust operational order, toggle visibility, update coordinates, and broadcast live route hints.
- **Reward System**: Incentivizes fans to take detours to less crowded gates by offering reward points, which can be redeemed for food discounts or other perks.
- **Interactive Mapping**: Integrates `Leaflet` and OpenStreetMap to render interactive stadium maps for both fans and organizers.
- **Crowd Privacy Studio**: Advanced features for maintaining data privacy while still aggregating useful crowd metrics.

---

## 💻 Frontend Applications (`apps/web`)

The Next.js application serves three primary routes:

- **`/` (Landing Page)**: The entry point outlining the platform's benefits for the stadium.
- **`/fan` (Fan Dashboard)**:
  - **`FanDashboard.tsx`**: Main component handling user state and data fetching.
  - **`GateRecommendationPanel.tsx`**: Displays the optimal gate based on live metrics.
  - **`StadiumMap.tsx`**: Visual representation of the stadium using Leaflet.
- **`/organizer` (Organizer Dashboard)**:
  - **`OrganizerDashboard.tsx` / `OrganizerCommandCenter.tsx`**: Tools for stadium staff to manually update queue statuses and manage gates.
  - **`OrganizerMap.tsx`**: An authoritative map view of crowd flows.

---

## 🔌 API Reference & Documentation (`apps/api`)

The Express.js backend provides a RESTful API under the `/api` prefix. 

### Health Check
- **`GET /health`**
  - Returns `{ "ok": true }` to verify server status.

### Gates API (`/api/gates`)
- **`GET /api/gates`**
  - Returns a list of all gates, including their status, queue delays, and coordinates.
- **`GET /api/gates/recommendation`**
  - **Query Params**: `lat`, `lng` (User's current location).
  - Calculates and returns the most optimal gate utilizing OSRM routing and live queue data.
- **`POST /api/gates`**
  - Creates a new stadium gate.
- **`PUT /api/gates/:gateId`**
  - Updates existing gate properties (e.g., toggling visibility, changing status).

### Reports API (`/api/reports`)
- **`GET /api/reports`**
  - Retrieves a historical list of crowd reports submitted by fans or staff.
- **`GET /api/reports/live`**
  - Returns the aggregated live state of stadium crowds.
- **`POST /api/reports`**
  - Submits a new crowd density report for a specific location/gate.
- **`POST /api/reports/:reportId/verify`**
  - Verifies a user-submitted report (often done by organizers) to improve data accuracy.

### Updates API (`/api/updates`)
- **`GET /api/updates`**
  - Fetches the latest live updates or announcements broadcasted by the organizers.
- **`POST /api/updates`**
  - Broadcasts a new stadium-wide announcement or route hint.

### Rewards API (`/api/rewards`)
- **`GET /api/rewards/profile`**
  - Retrieves the current fan's reward profile and point balance.
- **`POST /api/rewards/detour-points`**
  - Awards points to a fan who successfully followed a detour to a less congested gate.
- **`POST /api/rewards/redeem-food`**
  - Deducts points from the user's profile in exchange for a food discount or perk.

---

## 🗄️ Database Schema Overview

The platform uses a lightweight **SQLite** database (`sql.js`), meaning no external database server is required.

The underlying schema encompasses:
- **Gates Table**: Stores `id`, `name`, `latitude`, `longitude`, `status`, and base `queue_delay`.
- **Reports Table**: Stores crowdsourced reports (`gate_id`, `density_level`, `timestamp`, `verified_status`).
- **Updates Table**: Stores organizer announcements (`message`, `timestamp`, `severity`).
- **Reward Profiles Table**: Maps a user session/ID to their `points_balance` and `redemption_history`.

*(Data is persisted to `./apps/api/data/stadium-flow.sqlite` based on `.env` configuration)*
