# LUMII Data Dictionary

The authoritative schema is `prisma/schema.prisma`. This document explains each
model and the non-obvious fields. All user-owned rows carry `userId` and are
deleted with the user (`onDelete: Cascade`); optional cross-references use
`SetNull` so deleting a subject or topic does not delete dependent data.

## Enums

- **MaterialType**: `PDF`, `NOTE`.
- **MaterialStatus**: `PENDING_UPLOAD`, `READY`, `FAILED`.
- **SessionStatus**: `PLANNED`, `COMPLETED`, `MISSED`, `CANCELLED`.
- **MoodLabel**: `MOTIVATED`, `NEUTRAL`, `TIRED`, `STRESSED`, `FRUSTRATED`.
- **Rank**: `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`.
- **EventType**: `SESSION_STARTED`, `SESSION_COMPLETED`, `SESSION_MISSED`,
  `QUIZ_COMPLETED`, `SUMMARY_GENERATED`, `TROPHY_UNLOCKED`, `RANK_UP`,
  `MOOD_LOGGED`, `ADHERENT_DAY`, `PERFECT_DAY`.

## Models

### User
The local mirror of a Clerk account. `clerkId` is the stable identity key.
`timezone` (IANA) drives all day boundaries for streaks and adherence.

### Subject / Topic
The organising hierarchy. Both support `archivedAt` (archive over delete). A
topic belongs to a subject and to a user.

### Material
A PDF or a typed note. PDFs store `r2Key`, `mimeType`, `sizeBytes`, and
`checksum`; notes store `noteText`. A database CHECK enforces the union (a NOTE
has note text and no file fields; a PDF has file fields and no note text).
`status` tracks the upload lifecycle.

### Summary
A generated markdown revision summary for a material, with the `modelId` that
produced it and a `generationVersion` for reproducibility.

### QuizCompletion
**Non-content** completion metadata only: counts, duration, model, and a unique
`idempotencyKey` (the quiz instance id). It never stores questions, options, or
answers, so it is a practice-completion record, not a quiz history.

### ScheduledSession
A planned study block. `plannedStart`/`plannedEnd` are instants;
`plannedLocalDate` (YYYY-MM-DD) and `planningTimezone` capture the user's local
day for timezone-correct streaks. `targetDurationSec` is derived from the window.

### StudySession
An actual study session, optionally linked one-to-one to a `ScheduledSession`.
Tracks `startedAt`, `endedAt`, `lastHeartbeatAt`, `actualDurationSec`, the
`qualityScore` (+ `qualityVersion`), `autoClosed`/`autoCloseReason`, and bounded
engagement counters (`summariesViewed`, `tutorQuestions`, `quizAttempts`,
`explanationsReviewed`). A partial unique index allows only one open session
(`endedAt IS NULL`) per user.

### MoodCheckin
A privacy-hardened wellbeing signal. Stores `selfLabel` and/or `classifiedLabel`
only, never raw text, with an `expiresAt` (30 days) that is purged on access.

### GamificationProfile
The rebuildable projection of the XP ledger: `totalXp` (equal to the sum of all
`ActivityEvent.xpDelta`), `rank`, `currentStreak`, `longestStreak`, and
`lastAdherentDay`.

### Trophy / UserTrophy
`Trophy` is the catalog (lazily seeded from `lib/gamification/trophies.ts`).
`UserTrophy` records an unlock, unique per `(userId, trophyId)`.

### ActivityEvent
The append-only XP ledger and analytics source. Each row has a `type`, an
optional `sourceType`/`sourceId`, an `xpDelta`, and an optional unique
`idempotencyKey` that makes awards exactly-once (for example
`session-completed:<id>`, `quiz-completed:<id>`, `adherent-day:<userId>:<date>`).

### PublicProfile
The opt-in showcase. `handle` is unique and case-normalized; `isPublic` is the
authoritative visibility flag. `showRank`/`showXp` gate those fields. Only
allowlisted fields are ever exposed publicly.

## Integrity constraints (SQL)

Beyond Prisma relations, raw-SQL migrations add: the Material file/note union
check; non-negative quiz counts with `correctCount <= questionCount`; study
session range checks (durations >= 0, quality 0-100, counters >= 0); scheduled
session checks (`targetDurationSec > 0`, `plannedEnd > plannedStart`);
non-negative gamification totals; and the one-open-session partial unique index.
