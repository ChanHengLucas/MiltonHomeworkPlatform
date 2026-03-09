# Academic Planner

Monorepo for a school planner + support hub:
- `apps/web`: Vite + React + TypeScript
- `apps/api`: Express + TypeScript + sessions
- `packages/db`: SQLite repositories + migrations
- `packages/core`: deterministic planner logic

## What Works

- Auto auth mode selection:
  - `dev` mode (no Google) when OAuth env vars are missing in local development
  - `google` mode when OAuth env vars are configured (always in production)
- Dev/test identity simulation with Dev Identity Switcher (`/dev`)
- Personal assignments (including optional-task flag) + teacher-published assignments + teacher grading tasks
- Availability + deterministic plan generation (including Google Calendar busy blocks)
- Support Hub claim/unclaim/close/report flows with visibility rules
- Teacher-only Insights and teacher-only dashboard routes
- Server-backed planner preferences (study window, max session, breaks, late-night avoidance, optional course weights)
- In-app notifications (assignment posts, support lifecycle updates, comments, due reminders) with read/unread state
- Anonymous course feedback (student submission, teacher aggregate view)

## Quick Start (Dev)

1. Install dependencies:
```bash
npm install
```
2. Optional: copy env template if you want to customize ports/secrets/OAuth:
```bash
cp env.example .env
```
3. Start API + web:
```bash
npm run dev
```

With zero env vars set, local dev boots in automatic dev auth mode.

Optional port/env overrides:
```bash
# API on custom port, web proxy target auto-wired by npm run dev
API_PORT=4100 npm run dev

# Force web port
WEB_PORT=3005 npm run dev

# Explicit proxy target override
VITE_API_TARGET=http://localhost:4100 npm run dev
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
| `npm run db:reset` | Remove app DB files and rerun migrations |

## API Pathing and Proxy

- Frontend always calls relative same-origin paths (no hardcoded browser-side ports):
  - `/api/health`
  - `/api/auth/me`
  - `/api/settings/planner-preferences`
  - `/api/notifications/unread-count`
- Vite dev server proxies:
  - `/api` -> `VITE_API_TARGET` (or fallback)
  - `/auth` -> same target (legacy alias support)
- API canonical routes are mounted under `/api/*`; legacy `/auth/*` aliases are still mounted for compatibility.

## Dev vs Google Auth

- API auth mode is chosen at startup:
  - Production: always `google`
  - Development: `google` only when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are all set; otherwise `dev`
- Startup logs include:
  - `[Auth] mode=dev|google`
  - detected env flags (presence only, never secret values)
- Dev mode (`mode=dev`):
  - API accepts `X-User-Email`/`X-User-Name` headers automatically
  - `/api/auth/me` returns `{ mode: "dev" }` and does not require Google session
  - Login UI shows `DEV MODE (no Google)`, hides Google sign-in controls, and links directly to `/dev`
  - `/dev` is available in development even when signed out so local identity can be selected first
  - Header/Settings show identity source consistently as Dev vs Google
- Google mode (`mode=google`):
  - Uses Google OAuth + `express-session`
  - `/api/auth/me` returns 401 when signed out and 200 when session is present
  - Calendar import endpoints require this mode

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
- Personal assignments can be marked optional to de-prioritize them in planning warnings/order

Planner uses these rules on every `/api/plan` call.

## Calendar Busy Import

- Endpoint: `GET /api/calendar/busy?days=7`
- 5-minute in-memory cache per user + day range
- UI import button on `/availability`
- Imported busy blocks are shown in Availability and applied in Plan generation
- Error messages are explicit for auth/session expiry and quota limits
- In `dev` auth mode, calendar endpoints return:
  - `Google Calendar requires Google login; configure OAuth env vars.`

## Notifications

- Endpoints:
  - `GET /api/notifications`
  - `GET /api/notifications/unread-count`
  - `POST /api/notifications/:id/read`
  - `POST /api/notifications/read-all`
- Events covered:
  - course assignment posted
  - support request claimed/unclaimed/closed
  - new support comment on related requests
  - due reminders (24h / 6h) via periodic server scan
- UI:
  - header bell + quick panel
  - full `/notifications` page

## Course Feedback

- Student:
  - submit anonymous feedback in `Courses` (rating 1-5 + optional comment)
- Teacher:
  - view aggregated feedback stats and recent comments per course in `Courses`

## Build Notes

Web production build is stable:
- Dev-only QA route and Dev Identity Switcher are lazy-loaded and guarded behind `import.meta.env.DEV`
- Vite dev proxy is serve-only and excluded from production build config
- In production, route `/api/*` and `/auth/*` to `apps/api`, and `/` to `apps/web` static assets (or serve web assets from API behind one origin)

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
   - Verify DB path and port availability.
   - Check startup log for `[Auth] mode=...` and env detection.
2. Web can’t reach API in dev:
   - Check Vite proxy target (`VITE_API_TARGET`, default fallback `http://localhost:4000`).
   - Confirm browser requests are going to relative `/api/*` paths (not hardcoded localhost ports).
3. Google login button missing in localhost:
   - API is in automatic `dev` mode because OAuth env vars are incomplete.
   - Set all of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, then restart `npm run dev`.
4. E2E hits wrong server:
   - Ensure no stale process is using the configured E2E ports or override with `E2E_WEB_PORT` / `E2E_API_PORT`.
5. Calendar import errors:
   - Re-auth with Google if session expired.
   - Retry later on quota/rate-limit responses.
6. SQLite “disk I/O error” on writes:
   - DB file path:
     - `DATABASE_FILE` if set (resolved to an absolute path)
     - otherwise default `./data/app.db` (also resolved to absolute path)
   - Check API startup log for the resolved DB file path (`dbFile`).
   - Ensure the DB directory exists and is writable by your user.
   - Use `GET /api/db/health` to run a write/read DB probe.
   - On startup IO errors (`SQLITE_IOERR*`, short read, disk I/O), the DB layer now:
     - renames `app.db`, `app.db-wal`, `app.db-shm` to `*.corrupt-<timestamp>`
     - creates a fresh DB and reruns migrations
   - Manual safe reset:
   ```bash
   npm run db:reset
   ```
   - Include test DB files only when explicitly requested:
   ```bash
   npm run db:reset -- --include-test
   ```
