-- Defense in depth for the "one open StudySession per user" rule. Application
-- code already reconciles/auto-closes stale sessions before starting a new one,
-- but a partial unique index makes a concurrent double-start (e.g. a
-- double-clicked "Start") impossible at the database level. A second open row
-- (endedAt IS NULL) for the same user violates this index; the service catches
-- the conflict and returns the existing active session instead.
CREATE UNIQUE INDEX "one_open_session_per_user"
  ON "StudySession" ("userId")
  WHERE "endedAt" IS NULL;
