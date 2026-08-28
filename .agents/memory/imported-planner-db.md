---
name: Imported planner database setup
description: The imported planner API expects its Drizzle schema to exist in the development PostgreSQL database before dashboard requests can succeed.
---

The planner source can start cleanly while its first dashboard request still fails if the development database has not been synchronized with the current Drizzle schema.

**Why:** The API lazily creates settings and personal-day records, so a missing table appears as a runtime HTTP 500 rather than a startup failure.

**How to apply:** When restoring or importing this planner into a fresh project, sync the development schema before testing API-backed screens; do not treat a healthy server port as proof that the planner is ready.