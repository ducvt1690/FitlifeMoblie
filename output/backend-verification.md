# Backend verification — 05/11/2026

## Verified local implementation

- Trainer full template editing, transactionally frozen assignment snapshots, archive historical/delete unused templates.
- Individual assignment cancellation with mandatory reason, timestamp and status history; completion of a cancelled assignment rejected.
- Stable client assignment UUID prevents concurrent/repeated request duplication; conflicting payload reuse receives409. Legacy requests without an id remain compatible and cannot identify retries.
- Trainer disconnect, invite list/expiry/revoke, real assignment progress/feedback, server pagination/search/sort beyond100 total records.
- Actual role transitions require a nonempty audit reason on Backend; missing/blank reason receives400 before mutation. Old/new role, actor, target, timestamp and reason stored transactionally.
- Role transitions terminate consents, cancel assigned exercises, archive former Trainer templates and revoke sessions atomically. Regrant does not restore consent or activate archived templates.
- Temporary account lock retains the source policy: sessions/access revoked; existing relationships retained pending a product decision.
- Operator bootstrap now uses the same transactional revocation invariants; it was tested on a disposable replica, never executed to change a configured Atlas role.
- Admin catalog pagination/search/filter/detail; transaction/payment/log lookup with filters/details; immutable logs through public API; read-only payment management.
- Revenue groups Premium and Coin separately at Backend; paid only, explicit period/currency/formula/counts. Unsupported refunds/cancellations return null, not invented zero.
- Reward catalog write lock prevents redemption against stale availability during concurrent admin withdrawal.
- Date filters reject impossible calendar dates, timezone-less timestamps and out-of-range times. Date-only queries use UTC; ISO timestamps may carry an offset. Structured paging parameters are rejected.
- API root endpoint metadata and database role contract updated to current behavior. Current schema exports24 business collections plus auth auxiliaries.

## Proving commands and saved evidence

| Command / files | Result | Evidence |
| --- | --- | --- |
| `node --test --test-concurrency=1 backend/test/platform-regression.test.js backend/test/reward-withdrawal.test.js backend/test/roles.test.js backend/test/trainer.test.js` |23 tests,23 passed,0 failed,0 skipped;28.89s |`output/fullstack-backend-focused-tests.txt` |
| `npm --prefix backend run build` |82 JavaScript files syntax checked, exit0 |`output/fullstack-backend-latest-build.txt` |
| `node --test --test-concurrency=1 backend/database/mongodb/test/database.test.js backend/database/mongodb/test/sample-data.test.js` |20 passed,0 failed;11.11s before final audit-enum broadening |Tool execution record; full DB suite evidence owned by root |

The focused suite contains17 platform tests,1 deterministic reward-withdrawal concurrency test,3 role tests and2 original Trainer tests. It verifies real HTTP response codes, persisted MongoDB rows, concurrent requests, session expiry/revocation, frozen history, ownership, consent teardown/regrant, revenue split, unavailable reward rejection, pagination beyond100, known legacy validator migration and refusal of unknown drift.

Tests use disposable `MongoMemoryReplSet` with real MongoDB transactions; no test user/workout/payment data was inserted into configured Atlas.

## Configured Atlas schema migration

- Initial read-only plan found known audit target-type divergence: Atlas already allowed payment/exercise/setting audit targets. These existing enum entries are preserved; current validator accepts both known historical narrow schema and deployed broad schema through the additive migration.
- Reviewed dry-run is saved in `output/fullstack-atlas-migration-plan.json`. It found9 existing assignments,5 existing audit rows,0 invalid documents,0 invalid active consent/template owners,0 missing source templates. Both collections needed the additive validator expansion.
- Before applying, exact validator/options/index metadata and document counts/BSON EJSON SHA-256 digests were backed up in `output/fullstack-atlas-validator-backup.json`. The backup contains no credentials or business documents.
- Applied only2 `collMod` commands: `trainer_assignments` and `admin_logs`. No schema initializer, seed, document rewrite, field removal or role command was run on Atlas.
- `output/fullstack-atlas-migration-result.json` reports applied:true, verified:true, issues:[]. Assignment count9→9 and audit count5→5; both BSON EJSON SHA-256 digests remain exactly identical; all indexes unchanged.
- Current strict/error validators now accept the additive snapshot/history/cancellation/feedback and role-audit fields. No indexes were added, dropped or rebuilt.
-9 legacy assignments still lack historical snapshots because the migration deliberately does not rewrite existing documents. Their current template exists; before any future template edit the service freezes its current content transactionally. Content versions changed before snapshot support cannot be recovered or claimed verified.

The migration is repeatable: plan/apply against the new schema is a no-op. Unknown validator drift, invalid data, missing referenced templates or active former-Trainer relationships stops migration for review rather than modifying business history.

## Limits requiring accurate delivery status

- Native Mobile and independent Web evidence is reported by their owning tasks and the root final report, not inferred from API tests here.
- VNPay external sandbox settlement and real-device network access require their own evidence. Existing signed payment regression is separate from a live provider payment.
- Current consent covers assignment progress/feedback only. Full private health diaries, Trainer private notes, scheduling/deadlines, student refusal and automatic Workout/Coin linkage are not silently invented.
- The database-operator bootstrap retains the existing target-account principal convention and distinguishes `set_role_*` events from authenticated Admin API actions. This cannot identify an operator's external human identity without a separate identity mechanism.
