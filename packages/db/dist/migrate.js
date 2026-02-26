"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
// Simple entrypoint used by the root `db:migrate` script
// to ensure the database file exists and all migrations are applied.
// eslint-disable-next-line no-console
console.log('[DB] Running migrations...');
try {
    (0, index_1.initDb)();
    // eslint-disable-next-line no-console
    console.log('[DB] Migrations applied successfully.');
    process.exit(0);
}
catch (err) {
    // eslint-disable-next-line no-console
    console.error('[DB] Migration failed:', err);
    process.exit(1);
}
