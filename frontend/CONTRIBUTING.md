# Contributing

## Setup

```bash
npm ci
npm run dev
```

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Vitest unit and component tests |
| `npm run test:coverage` | Main coverage gate |
| `npm run test:coverage:components` | Component coverage gate |
| `npm run test:coverage:settings` | Settings coverage gate |
| `npm run test:e2e` | Playwright user journeys for Chromium desktop and mobile projects |
| `npm run lint` | ESLint including jsx-a11y rules |
| `npm run build` | TypeScript and production Vite build |
| `npm run check:bundle` | Gzip budget on built JS chunks |
| `npm run tauri:build` | Desktop shell build from the workspace root |

## Data Safety

Study data is local-first and stored in IndexedDB through Dexie. Keep destructive flows confirmed by the user and covered by tests.

Optional fields on stored records should stay backward-compatible with older IndexedDB rows and JSON exports. For example, flashcard scheduling fields are optional so older cards remain due immediately.

## Dependency Hygiene

The frontend uses plain CSS, Vite, React, Dexie, lucide icons, and Tauri plugins that are imported by the current app. Do not add a UI/charting/state dependency unless the product code imports it and the bundle budget still passes.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` and wait for the Dashboard or Good morning heading.
3. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

## Storybook

```bash
npm run storybook
```

Stories live next to components as `*.stories.tsx`.
