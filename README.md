# Academic Planner & Support Hub

A monorepo containing an AI Academic Planner (Part A), Help/Support Hub (Part B), merged workflow (Part C), and teacher insights (Part D).

## Tech Stack

- **Language:** TypeScript everywhere
- **Frontend:** React + Vite
- **Backend:** Node + Express
- **Database:** SQLite (better-sqlite3)
- **Logging:** pino (backend)
- **Validation:** zod
- **Testing:** vitest (core planner logic)
- **Lint:** eslint + prettier

## Quick Start

```bash
npm install
npm run dev
```

- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000

## Scripts

| Script       | Description                             |
|--------------|-----------------------------------------|
| `npm run dev`| Runs API + web concurrently            |
| `npm test`   | Runs core planner tests                 |
| `npm run test:unit` | Vitest unit tests (packages/core)   |
| `npm run test:api` | API smoke tests (spawns API, runs health/assignments/requests/claim checks) |
| `npm run test:e2e` | Playwright E2E tests (spawns API + Vite, runs full flows) |
| `npm run test:all` | Runs test:unit, test:api, test:e2e in order |
| `npm run lint` | ESLint across the monorepo           |
| `npm run format` | Prettier format                       |
| `npm run db:migrate` | Applies SQLite migrations          |

## Project Structure

```
/
  apps/
    web/        # Vite React frontend
    api/        # Express backend
  packages/
    core/       # Shared logic: parsing, scheduling, types
    db/         # SQLite access, migrations, repositories
```

## Features

### Part A — AI Academic Planner (MVP)

- **Assignment ingestion:** Paste text, parse title/est time/type, confirm and create
- **Assignments CRUD:** Create, list, mark done, delete
- **Availability:** Add blocks by day + start/end, list, remove
- **Plan generation:** Deterministic scheduler by urgency, allocates into availability
- **Pages:** /assignments, /availability, /plan, /settings

### Part B — Support Hub (MVP)

- **Help requests:** Create, list, filter by subject/urgency/status
- **Request workflow:** Claim, close
- **Comments:** Post and display on request detail
- **Pages:** /support, /support/:id

### Part C — Merge

- From an assignment, "Need help?" opens a prefilled help request form
- Request stores `linkedAssignmentId`
- Request detail shows link back to assignments

### Part D — Teacher Value Layer (D2)

- **Insights endpoint:** `GET /api/insights/requests-summary`
- Returns counts grouped by subject, urgency, status
- **Page:** /insights (simple dashboard)

## Environment

Copy `.env.example` to `.env` (optional). Backend uses defaults if `.env` is missing:

- `PORT=4000` (API)
- `DATABASE_FILE=./data/app.db`

## Bugfix Notes

- **dueAt storage format:** Assignments store `dueAt` as epoch milliseconds (INTEGER) or NULL. Never 0. Use `toDateTimeLocalValue` / `fromDateTimeLocalValue` for datetime-local input. Display with `formatDueDate` (shows "No due date" when null/invalid).
- **Closed request TTL cleanup:** Help requests closed more than 7 days ago (configurable via `CLEANUP_TTL_DAYS`) are automatically deleted by a background job every hour. Their comments are also removed. Use `POST /api/admin/cleanup-closed?days=7` for manual cleanup (guarded in production). Dev Settings has "Run cleanup now" button.
- **Teacher mode gating:** Teacher mode is only available when the user's school email (in Settings) is `@milton.edu` and does **not** match the student pattern: two digits before the `@` (e.g. `something12@milton.edu`). Faculty/staff emails are eligible.
- **Identity is simulated:** No OAuth. User identity (email, display name) is stored in Settings (localStorage) and sent via `X-User-Email` and `X-User-Name` headers on every request. The backend uses this for request ownership (`createdByEmail`), claim restriction (no self-claim), and comment author role (requester/helper/other).

- **Dev testing with identity switcher:** In development (`npm run dev`), a "Dev Identity" dropdown appears in the header. Use it to switch between Student A (lucas12@milton.edu), Student B (test34@milton.edu), and Teacher (hales@milton.edu) to test permission logic. The QA page (`/qa`) provides a test harness to seed demo data and run manual verification flows.

## E2E Tests

E2E tests use Playwright (headless Chromium). The test runner (`scripts/run-e2e.js`) spawns the API on port 4000 and Vite on port 3000, waits for both to be ready, then runs Playwright.

**Coverage:**
- Assignments: create, due date display, persist after refresh
- Availability: add block, verify in list
- Plan: seed availability, generate, verify sessions
- Support Hub: create request, claim as different user, comment as helper, self-claim blocked
- Close + cleanup: close request, cleanup deletes from DB
- Insights: Teacher gating, aggregated stats, urgency labels (Medium not med)
- QA page: seed demo data, claim/comment/self-claim/insights flows

**Test DB:** E2E and API smoke tests use `data/test.db` (via `DATABASE_FILE` env) to avoid polluting dev data.

**Headed mode:** Run `npx playwright test --headed` after starting servers manually (`npm run dev`), or use `PWDEBUG=1` for step-through debugging.

## Troubleshooting

1. **API fails to start:** Run `npm run db:migrate` first to ensure the database exists.
2. **Port already in use:** If you see `EADDRINUSE`, another process is using port 3000 or 4000. Stop it or kill it (e.g. `lsof -i :4000` then `kill <pid>`).
3. **Vite engine warning:** Requires Node 20.19+ or 22.12+; Node 20.16 works but may show a warning.
4. **CORS:** The API allows all origins in development. Configure CORS for production.

---

## KNOWN LIMITATIONS

The following are intentionally **not** included in this MVP:

- **No Google OAuth** — Authentication is skipped for speed; no sign-in flow
- **No Schoology integration** — No direct import from Schoology; paste text manually
- **No real email sending** — No notifications or email delivery
- **No full messaging system** — Comments are simple; no real-time chat or threading
- **No gradebook/submissions** — No grading features or file uploads
- **Auth:** Optional; MVP runs without auth (single local dev user or none)
