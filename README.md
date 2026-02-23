# Pot of Greed — Travel Expense Worksheet

A shared travel expense tracker for group trips. Built with React, Redux Toolkit, and Vite. Data syncs in real-time across devices via Firebase.

## Features

- **Expense Tracking** — Log expenses with date, category, description, amount, payer, payment method, reference code, and receipt upload
- **Categories** — Meals, Drinks, Fuel, Toll, Entrance Fees, Others
- **Split Expenses** — Split costs among selected travelers
- **Funds Management** — Track hotel costs, parking, payments to hotel, and DP (downpayment) collections per traveler
- **Summary** — Total expenses, per-category breakdown, per-person paid vs. share with balance
- **Settlement** — Calculates who owes whom with minimized transactions
- **Auto-Sync** — Real-time sync via Firebase Realtime Database
- **Admin Lock** — Password-protected admin mode with 5-minute session expiry, SHA-256 salted hash, and 3-attempt lockout
- **Export** — CSV export and print support
- **Dark Theme** — Animated UI with Framer Motion
- **Token-based Access** — Each user gets a unique URL with a `?u=` hash parameter
- **Anti-spam** — Throttle on expense submission
- **Bulk Actions** — Multi-select delete for expenses and collections
- **Input Validation** — Inline error highlighting

## Tech Stack

- **Frontend:** React 19, Redux Toolkit, Framer Motion, Vite 5
- **Data Sync:** Firebase Realtime Database (real-time sync across devices)
- **File Storage:** Azure Blob Storage (receipt and QR code uploads)
- **Hosting:** Azure Storage Static Website

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

Generate a salt:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
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

### Manual Azure Setup

Enable static website on the storage account:

```bash
az storage blob service-properties update \
  --account-name yourstorageaccount \
  --static-website \
  --index-document index.html \
  --404-document index.html
```

Upload the build output:

```bash
az storage blob upload-batch \
  --account-name yourstorageaccount \
  --source dist \
  --destination '$web' \
  --overwrite
```

Enable CORS for blob sync:

```bash
az storage cors add \
  --services b \
  --methods GET PUT OPTIONS \
  --origins "https://yourstorageaccount.z23.web.core.windows.net" \
  --headers "*" \
  --exposed-headers "ETag" \
  --max-age 3600 \
  --account-name yourstorageaccount
```

## SAS Token Requirements

The SAS token needs **Read + Write + Create** permissions on the **Blob** service, scoped to the `travel-expenses` container.

## User Access

Each user gets a unique URL with a `?u=` hash token derived from their name + salt. Only tokens in the allowlist are accepted.

## Project Structure

```
app/src/
  components/     UI components
  store/          Redux slices (trip, toast, sync, admin)
  hooks/          useAdmin, useOnline, useTheme
  utils/          Helpers, constants, sync logic, Firebase config
  test/           Unit tests (Vitest)
```
