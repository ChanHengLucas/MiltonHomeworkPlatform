# Academic Planner

Monorepo for a school planner + support hub:
- `apps/web`: Vite + React + TypeScript
- `apps/api`: Express + TypeScript + sessions
- `packages/db`: SQLite repositories + migrations
- `packages/core`: deterministic planner logic

## What Works

- Google OAuth session auth (`/auth/google/start`, `/auth/google/callback`, `/auth/me`)
- Dev/test identity simulation with `MOCK_AUTH=1` + Dev Identity Switcher
- Personal assignments + teacher-published assignments + teacher grading tasks
- Availability + deterministic plan generation (including Google Calendar busy blocks)
- Support Hub claim/unclaim/close/report flows with visibility rules
- Teacher-only Insights and teacher-only dashboard routes
- Server-backed planner preferences (study window, max session, breaks, late-night avoidance, optional course weights)

## Quick Start (Dev)

1. Install dependencies:
```bash
npm install
```
2. Copy env template if needed:
```bash
cp .env.example .env
```
3. Start API + web:
```bash
npm run dev
```

Default URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start API + web together |
| `npm run build:web` | Build web app only (`apps/web`) |
| `npm run build` | Build core, db, api, and web |
| `npm run test:unit` | Core Vitest unit tests |
| `npm run test:api` | API smoke tests (isolated test DB) |
| `npm run test:e2e` | Playwright E2E (spawns isolated API + Vite ports) |
| `npm run test:smoke` | Unit + API smoke |
| `npm run test:all` | Unit + API smoke + E2E |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Auth Modes

- Normal mode:
  - Uses Google OAuth + `express-session`.
  - Identity comes from session user.
- Test/dev mock mode:
  - Set `MOCK_AUTH=1`.
  - Identity is read from `X-User-Email`/`X-User-Name` headers.
  - E2E uses this mode and the web Dev Identity Switcher.

Teacher eligibility:
- `@milton.edu` domain
- NOT student pattern (two digits before `@`)

## Planner Preferences

Settings page stores deterministic preferences server-side:
- Preferred study window (`start/end`)
- Max session length
- Break between sessions
- Avoid late-night sessions
- Optional per-course priority weights

Planner uses these rules on every `/api/plan` call.

## Calendar Busy Import

- Endpoint: `GET /api/calendar/busy?days=7`
- 5-minute in-memory cache per user + day range
- UI import button on `/availability`
- Imported busy blocks are shown in Availability and applied in Plan generation
- Error messages are explicit for auth/session expiry and quota limits

## Build Notes

Web production build is stable:
- Dev-only QA route and Dev Identity Switcher are lazy-loaded and guarded behind `import.meta.env.DEV`
- Vite dev proxy is serve-only and excluded from production build config

Run:
```bash
npm run build:web
```
or full workspace:
```bash
npm run build
```

## Testing Notes

- `scripts/run-api-smoke.js` and `scripts/run-e2e.js` reset `data/test.db` before each run.
- E2E uses isolated ports by default (`web:3100`, `api:4100`) to avoid collisions with local dev servers.
- Playwright config reads `BASE_URL` from environment.

If browsers are missing:
```bash
npx playwright install --with-deps chromium
```

## Troubleshooting

1. API won’t start:
   - Verify `SESSION_SECRET`, DB path, and port availability.
2. Web can’t reach API in dev:
   - Check Vite proxy target (`VITE_API_PROXY_TARGET`, default `http://localhost:4000`).
3. E2E hits wrong server:
   - Ensure no stale process is using the configured E2E ports or override with `E2E_WEB_PORT` / `E2E_API_PORT`.
4. Calendar import errors:
   - Re-auth with Google if session expired.
   - Retry later on quota/rate-limit responses.
