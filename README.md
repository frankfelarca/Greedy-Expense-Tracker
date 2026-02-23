# The Cure — Travel Expense Worksheet

A shared travel expense tracker for group trips. Built with React, Redux Toolkit, and Vite.

## Tech Stack

- **Frontend:** React 19, Redux Toolkit, Framer Motion, Vite
- **Data Sync:** Firebase Realtime Database (real-time sync across devices)
- **File Storage:** Azure Blob Storage (receipt uploads)
- **Hosting:** Azure Storage Static Website

## Features

- Expense tracking with categories, payment methods, and receipt uploads
- Fund management (hotel costs, payments, DP collections)
- Per-person summary and settlement calculations
- CSV export and print support
- Real-time sync via Firebase RTDB
- Token-based user access (`?u=` hash parameter)
- Admin mode with password protection and lockout
- Anti-spam throttle on expense submission
- Multi-select bulk delete for expenses and collections
- Input validation with inline error highlighting

## Setup

```bash
cd app
npm install
```

Copy `.env` and fill in the values:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATA_PATH=trips/default

VITE_AZURE_ACCOUNT=
VITE_AZURE_SAS_TOKEN=

VITE_ADMIN_PASS=
VITE_ADMIN_SALT=
```

## Development

```bash
npm run dev
```

## Build & Deploy

```bash
npm run build
./deploy.sh
```

The deploy script builds the app and uploads `dist/` to the Azure Storage `$web` container. Requires Azure CLI (`az`) and being logged in.

## User Access

Each user gets a unique URL with a `?u=` hash token derived from their name + salt. Only tokens in the hardcoded allowlist are accepted.
