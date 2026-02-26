# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Academic Planner & Support Hub — npm workspaces monorepo (TypeScript). See `README.md` for full feature list and scripts table.

### Services

| Service | Port | Start command |
|---------|------|---------------|
| Express API | 4000 | `npm run dev:api` |
| Vite React frontend | 3000 | `npm run dev:web` |
| Both together | 3000 + 4000 | `npm run dev` |

SQLite is embedded (file-based at `./data/app.db`); no external DB service needed.

### Key commands

All documented in `README.md` Scripts table. Quick reference:

- **Dev:** `npm run dev`
- **Lint:** `npm run lint`
- **Unit tests:** `npm run test:unit`
- **API smoke tests:** `npm run test:api`
- **E2E tests:** `npm run test:e2e`
- **All tests:** `npm run test:all`
- **DB migrate:** `npm run db:migrate`

### Gotchas

- Before starting dev servers, ensure ports 3000 and 4000 are free. The API smoke test (`npm run test:api`) spawns and kills its own API process, but if it is interrupted it can leave port 4000 occupied. Check with `lsof -ti :4000` if you get `EADDRINUSE`.
- The `db:migrate` script first builds `packages/core` and `packages/db` before running migrations. If you see API errors about missing columns, re-run `npm run db:migrate`.
- Identity is simulated via localStorage + HTTP headers. Use the Dev Identity dropdown in the header (Student A / Student B / Teacher) or configure in Settings. No OAuth/login needed for development.
- ESLint has ~30 pre-existing lint errors (mostly `import/order` style issues). These are in the existing codebase and are not regressions.
- Vite proxies `/api` and `/auth` to the Express backend on port 4000. The API must be running for the frontend to work properly.
- E2E and API smoke tests use `data/test.db` to avoid polluting dev data.
