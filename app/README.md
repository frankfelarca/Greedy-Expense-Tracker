# Travel Expense Worksheet

A group travel expense tracker built with React + Redux + Vite, designed for tracking shared expenses, hotel costs, and settlements among travelers. Data syncs automatically to Azure Blob Storage.

## Features

- **Expense Tracking** — Log expenses with date, category, description, amount, payer, payment method, reference code, and receipt upload
- **Categories** — Hotel, Meals, Fuel, Toll, Entrance Fees
- **Split Expenses** — Split costs among selected travelers
- **Funds Management** — Track hotel costs, payments to hotel, and DP (downpayment) collections per traveler
- **Summary** — Total expenses, per-category breakdown, per-person paid vs. share with balance
- **Settlement** — Calculates who owes whom with minimized transactions
- **Auto-Sync** — Real-time sync to Azure Blob Storage with ETag-based optimistic concurrency and conflict resolution
- **Admin Lock** — Global password-protected admin mode with 5-minute session expiry, SHA-256 salted hash (password never in bundle), and 3-attempt lockout for 5 minutes
- **Export** — CSV export and print support
- **Dark Theme** — Animated UI with Framer Motion

## Tech Stack

- React 19, Redux Toolkit, Framer Motion, Vite 5

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your values:

```
VITE_AZURE_ACCOUNT=yourstorageaccount
VITE_AZURE_SAS_TOKEN=?sv=2024-11-04&ss=b&srt=sco&sp=rwlac&se=...
VITE_AZURE_BLOB_NAME=expenses.json
VITE_ADMIN_PASS=yourpassword
VITE_ADMIN_SALT=random32charhexstring
```

Generate a salt:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Development

```bash
npm run dev
```

## Build & Deploy to Azure Static Website

```bash
npm run build
```

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

## Project Structure

```
src/
  store/          Redux slices (trip, toast, sync, admin)
  hooks/          useAdmin hook
  components/     UI components
  utils/          Helpers, constants, sync logic
```
