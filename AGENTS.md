# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is the **Academic Planner & Support Hub** monorepo (`academic-planner-support-hub-monorepo`). See `README.md` for full Quick Start and script reference.

### Key services

| Service | Port | Command |
|---|---|---|
| Express API | 4000 | `npm run dev:api` |
| Vite web (React SPA) | 3000 | `npm run dev:web` |
| Both together | 4000 + 3000 | `npm run dev` |

SQLite is embedded (no external DB server needed). The DB file is auto-created at `data/app.db`.

### Auth in development

With no Google OAuth env vars set, the API starts in **dev auth mode** automatically. Use the Dev Identity Switcher at `/dev` to impersonate student or teacher accounts. No credentials are needed for local development.

### Gotchas

- **Native modules**: `better-sqlite3` ships a prebuilt native addon. If you see `invalid ELF header` errors, run `npm rebuild better-sqlite3` to recompile for the current platform.
- **Web production build (`npm run build`)**: The `tsc -b` step in `apps/web` may fail with Vite plugin type mismatches due to duplicate `vite` versions (root vs workspace). The Vite dev server (`npm run dev:web`) works fine regardless — this only affects `tsc -b` during production builds.
- **Port collisions**: API smoke tests use port 4200, E2E tests use 4100/3100. Stop dev servers before running these test suites to avoid `EADDRINUSE`.
- **Playwright browsers**: E2E tests require Chromium. Install with `npx playwright install --with-deps chromium` if missing.

### Standard commands

Refer to `README.md` → **Scripts** table for the full list. Key ones:

- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- API smoke tests: `npm run test:api`
- E2E tests: `npm run test:e2e` (needs Playwright browsers installed)
- Full build: `npm run build`
- DB reset: `npm run db:reset`
