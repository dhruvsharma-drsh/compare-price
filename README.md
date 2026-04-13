# Global Price Compare

Full-stack product price comparison (v1):
- **Web**: React + TypeScript + Tailwind + Vite
- **API**: Node.js + Express + TypeScript + Playwright + Prisma
- **DB**: PostgreSQL (cache + price history)
- **FX**: Frankfurter API

## Folder structure
- `apps/web`: frontend
- `apps/api`: backend
- `packages/shared`: (optional) shared schemas/types (kept minimal in v1)

## Environment variables

### API (`apps/api/.env`)
Create a `.env` file based on `apps/api/.env.example`:
- `PORT` (default `4000`)
- `DATABASE_URL` (Postgres connection string)
- `LISTING_TTL_MINUTES` (cache TTL, default `20`)

Important for shared databases:
- Use a dedicated schema in `DATABASE_URL`, for example:
  - `...?sslmode=require&schema=compare_price`
- This prevents Prisma from touching unrelated existing tables in `public`.

### Web
Web uses `http://localhost:4000` for the API in v1 (hardcoded). For Vercel, change to a build-time env and use it in fetch calls.

## Local development

### 1) Start Postgres
If you already have Postgres running, skip this. Otherwise, run Postgres however you prefer (Docker, local install, Railway local, etc.).

### 2) API

```bash
cd "compare-price/apps/api"
copy .env.example .env
npx prisma generate
# Create tables (choose one):
# - For local dev: `npx prisma migrate dev` (requires db access)
# - For prod: `npx prisma migrate deploy` (requires migrations)
# - For schema-only sync: `npx prisma db push` (safe when using dedicated schema)
npm run dev
```

API health: `GET http://localhost:4000/health`

### 3) Web

```bash
cd "compare-price/apps/web"
npm run dev
```

Open: `http://localhost:5173`

## Deployment

### Vercel (web)
- Project root: `compare-price/apps/web`
- Build command: `npm run build`
- Output: `dist`

### Render/Railway (api)
- Project root: `compare-price/apps/api`
- Build command: `npm install && npx prisma generate && npm run build`
- Start command: `npm run start`
- Set env vars: `DATABASE_URL`, `PORT`

### Playwright note
On Render/Railway you may need to install browser dependencies. If deploy fails, add a build step:

```bash
npx playwright install --with-deps chromium
```

