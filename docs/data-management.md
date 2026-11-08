# Data management

Study data is local-first. Everything is saved in the browser with Dexie + IndexedDB. There is
no HTTP API server and no cloud database.

First launch starts empty with create-first actions. Existing customized data from the older
`study-dashboard-v2` browser storage key is migrated once when it is safe to do so.

## Reliability of everyday edits

Workspace create, edit, delete, and status/review actions use a shared local mutation pattern:

- Pending controls block repeated submissions while a write is in flight
- Forms stay populated and open after a failed save so you can retry
- Forms reset or close only after a successful write
- Failed deletes leave the record visible
- Status and review failures preserve the original visible state
- Success and error feedback use accessible status and alert announcements (no raw database errors)

## Goals

- **Manual progress** — you set and edit progress yourself; values are stored in **points**.
- **Study time** — progress is calculated automatically from **finalized recorded study
  sessions** (unfinished focus sessions do not count until they are saved to history).
- **Period** is separate from metric: daily, weekly, or monthly.
- **Units:** daily study-time goals use **minutes**; weekly and monthly study-time goals use
  **rounded hours**.
- **Weekly study-time** totals use the existing **rolling seven local calendar days ending
  today** (not an ISO or fixed calendar week).
- **Monthly study-time** totals use the **current local calendar month**.
- **Renaming a goal does not change** how it is calculated; only the stored metric and period
  matter.

## Subjects

- **Manual progress** — you set a percentage (0–100); the value stays stored even if you
  switch modes.
- **Study time** — progress is **matching finalized study-session minutes ÷ (target hours ×
  60)**, clamped to 0–100. It uses all matching recorded sessions (not limited to a
  day/week/month). Unfinished focus sessions do not count until they are saved to history.
- New subjects default to **Manual progress**. The Subjects editor lets you choose the mode;
  Progress % appears only in manual mode.
- Subject cards and Home search use one shared calculator for the displayed percentage.
- **Subject Distribution** on Progress is separate: it shows each subject's share of total
  logged study time, not progress toward a subject's target hours.

## Focus sessions

- Running and paused unfinished sessions are restored after reload or browser reopen.
- Timed focus sessions safely handle Pause and Resume at the completion boundary by
  re-checking the saved session before completing.
- Sessions at least 12 hours old show Resume / Discard instead of the normal timer.
- A successful backup import replaces local data and immediately resynchronizes the visible
  focus state from IndexedDB.

## Backups

- New exports use plain, unencrypted JSON format **version 4** (`version: 4`) with an explicit
  `metric` on every goal and an explicit `progressMode` on every subject (`manual` or
  `study_time`).
- **Snapshot boundaries:** Snapshot acquisition occurs inside one readonly Dexie transaction
  covering all seven active database tables (`subjects`, `tasks`, `notes`, `events`,
  `studySessions`, `goals`, `settings`). Version and timestamp metadata, JSON stringification,
  Blob creation, object URL generation, and browser download initiation occur after
  transaction settlement.
- **Data included:** Export captures one point-in-time snapshot of all subjects, tasks, notes,
  calendar events, study sessions, goals, and supported settings (including
  `activeFocusSession` when present).
- **Data excluded:** Device-local appearance (`localStorage` theme selection) and sidebar
  collapse state are excluded from backups.
- **Snapshot timing:** Writes committed after snapshot acquisition begins may not appear in
  that export.
- **Security guidance:** Backup files are unencrypted JSON and should be stored and shared
  according to the sensitivity of the user's study data.
- **Import validation:** Valid **version 1**, **version 2**, and **version 3** backups remain
  importable. Goals without metrics (v1) and subjects without modes (v1/v2) are normalized
  from the **complete imported study-session set** **before** any local data is replaced.
  Legacy flashcards in v1–v3 backups are cleanly discarded on import. Current exports are
  always version 4.
- Version 3 and version 4 backups that omit or use an invalid subject `progressMode` (or goal
  `metric`) fail validation **before** table replacement; existing data stays intact.
- **Imports validate fully before replacing local data.** Size, shape/version, uniqueness,
  subject references, semantic integrity, known settings values, and record-count limits are
  checked first. Only then does IndexedDB clear and rewrite. Invalid imports leave existing
  data and the visible focus session unchanged.
- Integrity checks reject duplicate entity IDs and duplicate settings keys; orphan non-empty
  `subjectId` values (empty string remains General / unassigned); out-of-range subject
  progress or non-positive target hours; negative task minutes; non-positive session minutes;
  event or session end before start; and non-positive goal targets or negative goal progress.
- Known settings are checked (`dailyGoalMinutes > 0`; `quickNotes` string array up to 8;
  migration flag exactly `true`; `activeFocusSession` must match its domain contract). Unknown
  settings keys stay accepted and preserved for forward compatibility.
- Resource limits: **64 MiB** file bytes and text length (exports also gate canonical
  serialized bytes symmetrically on import); **25,000** portable records; subjects **500**;
  tasks/notes/events **5,000** each; study sessions **10,000**; goals **500**; portable
  settings **64**. Only `databaseGeneration` and `legacy-localstorage-migrated-v1` are
  internal and excluded from portable settings and total counts, consistently across import,
  export, and guarded mutations. Active focus and every unknown setting key count normally.
  Existing oversized workspaces may be edited or reduced without worsening their violated
  limits; internal metadata alone does not trigger that grandfathering path. Canonical byte
  enforcement remains unchanged.
- Import integrity is structural (ranges, uniqueness, references, order). Stricter UI editor
  limits (for example task minutes 5–720, or Progress's "session end not in the future" rule)
  are **not** re-enforced on import.
