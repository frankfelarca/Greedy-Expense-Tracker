#!/usr/bin/env bash
set -euo pipefail

ACCOUNT=$(grep '^VITE_AZURE_STORAGE_ACCOUNT=' .env | cut -d'=' -f2)
if [ -z "$ACCOUNT" ]; then
  echo "Error: VITE_AZURE_STORAGE_ACCOUNT not found in .env"
  exit 1
fi
CONTAINER="\$web"

if ! command -v az &> /dev/null; then
  echo "Error: Azure CLI (az) is not installed. Install it from https://aka.ms/installazurecli"
  exit 1
fi

echo "==> Building..."
npm run build

echo "==> Uploading dist/ to Azure Storage static website ($ACCOUNT)..."
az storage blob upload-batch \
  --account-name "$ACCOUNT" \
  --destination "$CONTAINER" \
  --source dist \
  --overwrite \
  --auth-mode key

echo "==> Done! Site available at: https://${ACCOUNT}.z23.web.core.windows.net/"

