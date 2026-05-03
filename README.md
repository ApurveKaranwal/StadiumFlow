# Stadium Flow Advisory 🏟️

Welcome to the **Stadium Flow Advisory** platform! This is a comprehensive monorepo project designed to manage and optimize live stadium crowd routing. It provides real-time gate recommendations, crowd updates, and a reward points system to incentivize fans to choose less congested routes, ensuring a smooth and safe stadium experience.

---

## 🚀 Quick Start

### 1. Setup & Installation
Clone the repository and install all dependencies:
```bash
cd stadium-advisory-platform
npm install
```

### 2. Environment Variables
You need to set up two environment files:

**`apps/web/.env.local`**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

**`apps/api/.env`**
```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
SQLITE_PATH=./apps/api/data/stadium-flow.sqlite
```

### 3. Run Locally

Start the backend API server:
```bash
npm run dev:api
```
*(On the first run, it seeds the SQLite database automatically.)*

In a new terminal, start the Next.js frontend:
```bash
npm run dev:web
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **API Base URL**: [http://localhost:4000/api](http://localhost:4000/api)

---

## 📖 Further Reading

For a comprehensive guide on the platform's architecture, key features, API endpoints, and database schema, please refer to the detailed **[DOCUMENTATION.md](./DOCUMENTATION.md)**.
