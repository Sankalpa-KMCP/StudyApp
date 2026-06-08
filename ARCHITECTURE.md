# Architecture

Local-first study dashboard: React 19 + Vite + Dexie (IndexedDB) + Tailwind v4.

## Context tree

```mermaid
flowchart TB
  subgraph data [Data Layer]
    db[(IndexedDB / Dexie)]
    repos[db/repositories]
    dbHooks[db/hooks]
  end
  subgraph hooks [Hooks]
    timer[useTimerEngine]
    backup[useSessionBackup]
    journal[useJournalCalendar]
  end
  subgraph context [Context Providers]
    confirmP[ConfirmProvider]
    dataP[StudyDataProvider]
    timerP[StudyTimerProvider]
    uiP[StudyUIProvider]
  end
  subgraph ui [UI Tabs]
    focus[FocusTab]
    cards[CardsTab]
    analytics[AnalyticsTab]
    journalTab[JournalTab]
    settings[SettingsTab]
  end
  db --> repos
  repos --> dbHooks
  dbHooks --> dataP
  timer --> timerP
  backup --> timerP
  journal --> dataP
  confirmP --> dataP
  dataP --> focus
  timerP --> focus
  uiP --> focus
  dataP --> cards
  dataP --> analytics
  dataP --> journalTab
  timerP --> settings
```

## Testing pyramid

| Layer | Tool | Location |
|-------|------|----------|
| Unit | Vitest | `src/lib`, `src/db`, `src/hooks` |
| Component | Vitest + Testing Library | `src/components/**/__tests__` |
| Integration | Vitest + providers | `src/context/__tests__` |
| E2E | Playwright | `e2e/` |
| Visual / a11y | Storybook + addon-a11y | `src/**/*.stories.tsx` |

## Data flow

- **Repositories** encapsulate Dexie CRUD (`src/db/repositories`).
- **Domain hooks** (`src/db/hooks`) expose live queries via `dexie-react-hooks`.
- **StudyDataProvider** aggregates settings, tasks, history, categories, flashcards, notes.
- **StudyTimerProvider** owns timer engine, backup import/export, and task actions.
- **StudyUIProvider** owns tab routing, zen mode, toasts, and theme CSS variables.

Import hooks from `db/hooks` — not legacy shims.

## PWA / offline

- Service worker precaches the app shell (`vite-plugin-pwa`).
- IndexedDB is the source of truth; no remote API.
- `AppShell` shows an offline banner when `navigator.onLine` is false.
