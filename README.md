# MediBook - Clinic Appointment API

Express 5 + MySQL 8 (mysql2, parameterised queries, no ORM) + Redis (ioredis) worker.

## Repository layout

```
database/          schema.sql (DDL), seed.sql (sample data)
schema-diagram/    medibook-schema.png / .pdf (+ .dot source)
locales/           en.json, fr.json (feedback page)
src/
  config/          environment loading
  models/          ALL application SQL (db.js, patient/doctor/appointment/report models)
  services/        booking and cancellation rules (transactions)
  controllers/     HTTP handlers; call services/models, never SQL
  routes/          URL + method -> controller
  middleware/      central error handler
  utils/           pure rules: slot validation, refund policy, validators, time
  logging/         fs-based audit log (logs/audit.log)
  queue/           Redis producer, worker handlers, key names
  worker.js        separate worker process
tests/unit/        Jest unit tests (no DB or Redis)
tests/integration/ concurrency and flow tests (needs MySQL and Redis)
```

## Setup

Prerequisites: Node.js 18+, MySQL 8.0+, Redis 6.2+.

1. Create the database and load data (as a MySQL admin):
   ```sh
   mysql -u root -p < database/schema.sql
   mysql -u root -p medibook < database/seed.sql     # optional sample data
   ```
2. Create an application user (or use root for local dev):
   ```sql
   CREATE USER 'medibook'@'localhost' IDENTIFIED BY 'change_me';
   GRANT SELECT, INSERT, UPDATE, DELETE ON medibook.* TO 'medibook'@'localhost';
   ```
3. Start Redis (`redis-server`).
4. Configure: `cp .env.example .env` and fill in the values.
5. Install and run:
   ```sh
   npm install
   npm start            # web server on PORT (default 3000)
   npm run worker       # in a second terminal: waitlist promotion + notifications
   ```
6. Tests:
   ```sh
   npm test                 # unit tests, no services needed
   npm run test:integration # needs MySQL (schema + seed) and Redis running
   ```

The web server and worker are separate processes by design (Part E). `npm start` alone serves the API, but waitlist promotion and confirmation messages only happen while `npm run worker` is running.

## Endpoints

| Method | Path | Purpose | Success | Errors |
|---|---|---|---|---|
| GET | /api/health | liveness | 200 | |
| GET | /api/patients | list patients | 200 | |
| POST | /api/patients | create patient | 201 + Location | 400 |
| GET | /api/patients/:id | one patient | 200 | 400, 404 |
| PATCH | /api/patients/:id | partial update | 200 | 400, 404, 409 (duplicate email) |
| DELETE | /api/patients/:id | delete (no appointments) | 204 | 400, 404, 409 (has appointments) |
| GET / POST | /api/doctors | list / create | 200 / 201 | 400 |
| GET | /api/doctors/:id | one doctor | 200 | 400, 404 |
| PATCH | /api/doctors/:id | partial update | 200 | 400, 404 |
| DELETE | /api/doctors/:id | delete (no appointments) | 204 | 400, 404, 409 |
| GET | /api/doctors/:id/stats | revenue, upcoming count, next 7 days, utilisation | 200 | 404 |
| POST | /api/appointments | book a slot | 201 + Location | 400, 404, 409, 422 |
| POST | /api/appointments | book; slot or day full and `"waitlist": true` | 202 (waitlisted) | 400, 404, 422 |
| GET | /api/appointments/:id | one appointment | 200 | 400, 404 |
| POST | /api/appointments/:id/cancel | cancel and compute refund | 200 | 400, 404, 409 |
| GET | /api/reports/doctors | every doctor's totals and revenue | 200 | |
| GET | /api/reports/busy-days | (doctor, date) above 80% of cap | 200 | |
| GET | /feedback?lang=fr | course feedback page | 200 | |

Error bodies have the form `{"error": {"code": "...", "message": "...", "details": [...]}}`.

Booking example:
```json
POST /api/appointments
{ "patient_id": 1, "doctor_id": 2, "slot_start": "2026-12-07 09:30", "waitlist": true }
```
`slot_start` is clinic-local time (`CLINIC_UTC_OFFSET_MINUTES`).

## Design justifications

### Part A/B - Normalisation and constraints
- Three tables: `patients`, `doctors`, `appointments`. The spreadsheet repeated patient and doctor details on every row. Those facts depend on the patient or doctor, not on the appointment, so they move to their own tables (3NF).
- `amount_paid` stays on the appointment. It is a historical snapshot of what was paid, so a later fee change does not rewrite past payments.
- **One patient per doctor slot.** `UNIQUE(doctor_id, active_slot)` where `active_slot` is a generated column: it equals `slot_start` while the appointment is booked and NULL once cancelled. A plain `UNIQUE(doctor_id, slot_start)` would block a cancelled slot from being rebooked, which the spec requires. MySQL allows many NULLs in a unique index.
- Working hours and 30-minute boundaries are CHECK constraints. The last start is 16:30, so the 30-minute slot ends by 17:00.
- The 12-per-day cap cannot be expressed as a CHECK, because a CHECK cannot count other rows. The booking transaction locks the doctor row (`SELECT ... FOR UPDATE`) and counts that day under the same lock.
- Cancellation fields are constrained together: a booked row carries no refund data, and a cancelled row must carry a refund percent of 0, 50 or 100 and an amount no greater than the amount paid.

### Part C - Booking and cancellation
- **Concurrency.** Bookings for one doctor are serialised by the row lock. Two patients can never hold the same slot, because the unique key is the final guard even if the lock were bypassed. Tested with 20 simultaneous requests: exactly one 201.
- **Status codes.** 400 malformed input, 404 missing patient/doctor/appointment, 409 conflicts (slot taken, daily cap, already cancelled, record in use), 422 rule violations (outside hours, not on a boundary, in the past), 201 created, 202 waitlisted.
- **Refund policy** (in `src/utils/refund.js`): notice more than 48 hours gives 100%; 24 to 48 hours inclusive gives 50%; under 24 hours gives 0%. Exactly 48 hours and exactly 24 hours both give 50%.
- **Cancellation atomicity.** The status change and the refund record are one transaction. The slot is released because the generated `active_slot` becomes NULL. The cancellation row is kept as refund history.
- **Statistics and reports** are computed by SQL in `src/models/reportModel.js`. A recursive CTE produces all seven days, including days with no bookings. The report uses LEFT JOIN so doctors with no appointments appear.

### Part D - Audit log
- `src/logging/auditLogger.js` uses `fs/promises` (async, no `*Sync` calls). It creates `logs/` on first write (`mkdir -p`) and never rejects: a failure goes to stderr, so the user's request still succeeds.
- Each successful booking and cancellation writes a JSON line. The worker also writes each confirmation message there.

### Part E - Queues and the waitlist
- **Enqueuing the waitlist.** When a booking fails because the slot is taken (scope `slot`) or the day is at cap (scope `day`), and the patient sent `waitlist: true`, the patient joins `waitlist:doctor:<id>` in Redis and receives 202.
- **Promotion.** A cancellation commits first, then pushes a `slot_freed` job. The worker finds the first patient waiting for that slot or date. It atomically moves that entry into `waitlist:inflight` (a Lua script, so two workers cannot claim the same patient) and books them.
- **What if the promoted booking fails?** The patient is never dropped:
  1. The entry is parked in `waitlist:inflight` while the booking runs. After a crash, the worker restarts and returns in-flight entries to the head of their waitlist.
  2. A conflict or transient error puts the patient back at the **head** of the waitlist with `attempts + 1`. They keep their place.
  3. After 3 failed attempts, or on a permanent error (patient deleted, slot now in the past), the entry moves to `waitlist:dead` with the reason, and an audit line is written. An administrator can see these.
  4. If the booking already exists (a previous attempt committed before a crash), the worker treats it as success instead of booking twice.
- **Jobs** (`jobs:queue`) use BLMOVE into `jobs:processing` and are acknowledged only after handling. Unprocessed jobs are recovered on restart. A failed job is logged as `job_failed`.
- **Known limitation.** If Redis is unavailable when a cancellation is committed, the `slot_freed` job cannot be queued. The cancellation still stands and the failure is logged, but that freed slot is not offered to the waitlist. A production fix would write the job in the same database transaction (a transactional outbox).

## Verification performed
- `schema.sql` runs on a fresh MySQL 8.0.46 server and re-runs without error.
- Each constraint was tested directly in MySQL: 17:00 start, 09:15, 08:30, duplicate doctor slot, second patient on the same slot, cancellation without a refund record, a non-tier refund percent, deleting a doctor with appointments, negative fee, and duplicate patient email. All were rejected. Rebooking a cancelled slot was accepted.
- `npm test`: unit tests for the refund tiers and boundaries, slot validation, time arithmetic, and input validators.
- Live API checks: status codes listed above, refund tiers, a waitlisted patient promoted by the worker after a cancellation, and concurrent booking races.
