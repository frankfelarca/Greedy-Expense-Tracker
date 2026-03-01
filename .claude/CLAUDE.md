# Greedy Expense Tracker (Pot of Greed)

Group travel expense tracker for splitting costs among travelers.

## Tech Stack

- React 19 + Vite 5 (SPA, no SSR)
- Redux Toolkit for state management
- Firebase Realtime Database (not Firestore) for cloud sync
- Azure Blob Storage for file uploads (receipts, QR codes, proof of payment)
- Framer Motion for animations
- jsPDF + jspdf-autotable for PDF export
- Vitest + Testing Library + happy-dom for tests
- PWA with service worker in `public/`

## Architecture

### State Management

Redux slices in `src/store/`:
- `tripSlice` — core trip data: travelers, expenses, hotels, funds, settlement proofs
- `syncSlice` — Firebase sync state, polling status, conflict resolution
- `adminSlice` — admin authentication and password management
- `toastSlice` — toast notification queue

### Auth Pattern

Token-based via URL params — each traveler gets a unique invite link with a hashed token. No session/cookie auth. Tokens are validated against hashed traveler names stored in Firebase.

### Sync Pattern

Polling-based via `startAutoPolling` in `src/utils/sync.js`. Not WebSocket or Firebase realtime listeners. The app polls Firebase at intervals and merges data into Redux.

### Data Storage

- Firebase Realtime DB: all trip data (expenses, travelers, hotels, funds, settlements)
- Azure Blob Storage: receipt images, QR code images, proof-of-payment uploads

## Project Structure

```
src/
  App.jsx                 # Root component, tab routing, auth flow
  components/             # All UI components (ExpenseForm, ExpenseTable, etc.)
  store/                  # Redux slices and store config
  hooks/                  # Custom hooks (useAdmin, useTheme, useOnline, useCountdownTo)
  utils/                  # Firebase client, sync logic, settlement algorithm, helpers
  test/                   # Unit tests for slices and utilities
```

## Key Conventions

- ESLint flat config (`eslint.config.js`) — no Prettier
- `no-unused-vars` rule ignores variables starting with uppercase or underscore
- `.jsx` extension for React components, `.js` for non-JSX modules
- All components are in `src/components/` (flat, no subdirectories)
- Tests live in `src/test/` (not co-located with source files)

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint check
- `npm run test` — run Vitest (single run)
- `npm run test:watch` — run Vitest in watch mode
- `./deploy.sh` — build and deploy to Azure Static Web Apps

## Key Features

- Multi-traveler expense splitting with custom split lists
- Hotel cost tracking with parking slots/nights breakdown
- Down payment (DP) collection tracking
- Greedy debt minimization settlement algorithm (`src/utils/settlements.js`)
- Proof of payment upload with accept/decline/partial workflows
- QR codes for GCash, Maya, Maribank, and custom wallets
- Admin role with password protection
- Expense locking by date with countdown
- 10-second "Nuke Data" countdown with cancel
