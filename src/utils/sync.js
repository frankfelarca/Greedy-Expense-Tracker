import { ref, get, set, update, onValue } from 'firebase/database';
import { db, isConfigured } from './firebase';
import { CONTAINER } from './constants';
import { setSyncStatus, setSyncing } from '../store/syncSlice';
import { loadCloudState, clearAll } from '../store/tripSlice';
import { toast } from '../store/toastSlice';

const DATA_PATH = import.meta.env.VITE_FIREBASE_DATA_PATH || 'trips/default';

function stripNulls(obj) {
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) out[k] = stripNulls(v);
    }
    return out;
  }
  return obj;
}

function getCloudState(tripState) {
  return stripNulls(JSON.parse(JSON.stringify(tripState)));
}

function getBlobUrl(config, path) {
  return `https://${config.account}.blob.core.windows.net/${CONTAINER}/${path}${config.sasToken}`;
}

export function getReceiptUrl(config, receiptPath) {
  if (!receiptPath || !config.account || !config.sasToken) return null;
  return getBlobUrl(config, receiptPath);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf'];
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'pdf'];

export function uploadReceipt(config, expenseId, file, onProgress) {
  if (file.size > MAX_FILE_SIZE) return Promise.reject(new Error('File too large. Maximum size is 10MB.'));
  if (!ALLOWED_TYPES.includes(file.type)) return Promise.reject(new Error('Invalid file type. Only images and PDFs are allowed.'));
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return Promise.reject(new Error('Invalid file extension.'));
  const safeExt = ext.replace(/[^a-z0-9]/g, '');
  const blobPath = `receipts/${expenseId}.${safeExt}`;

  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', getBlobUrl(config, blobPath));
      xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(blobPath);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed: network error'));
      xhr.send(file);
    });
  }

  return fetch(getBlobUrl(config, blobPath), {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type,
    },
    body: file,
  }).then(resp => {
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    return blobPath;
  });
}

export async function uploadQrCode(config, travelerName, file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('File too large. Maximum size is 10MB.');
  const safeName = travelerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const blobPath = `qrcodes/${safeName}.${ext}`;
  const resp = await fetch(getBlobUrl(config, blobPath), {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type,
    },
    body: file,
  });
  if (!resp.ok) throw new Error(`QR upload failed: ${resp.status}`);
  return blobPath;
}

export async function deleteQrCode(config, blobPath) {
  if (!blobPath || !config.account || !config.sasToken) return;
  const resp = await fetch(getBlobUrl(config, blobPath), { method: 'DELETE' });
  if (!resp.ok && resp.status !== 404) throw new Error(`QR delete failed: ${resp.status}`);
}

export async function uploadProofOfPayment(config, settlementKey, file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('File too large. Maximum size is 10MB.');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type. Only images and PDFs are allowed.');
  const safeKey = settlementKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const blobPath = `proofs/${safeKey}.${ext}`;
  const resp = await fetch(getBlobUrl(config, blobPath), {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type },
    body: file,
  });
  if (!resp.ok) throw new Error(`Proof upload failed: ${resp.status}`);
  return blobPath;
}

export async function deleteProofOfPayment(config, blobPath) {
  if (!blobPath || !config.account || !config.sasToken) return;
  const resp = await fetch(getBlobUrl(config, blobPath), { method: 'DELETE' });
  if (!resp.ok && resp.status !== 404) throw new Error(`Proof delete failed: ${resp.status}`);
}

export function getProofUrl(config, proofPath) {
  if (!proofPath || !config.account || !config.sasToken) return null;
  return getBlobUrl(config, proofPath);
}

export function getQrUrl(config, qrPath) {
  if (!qrPath || !config.account || !config.sasToken) return null;
  return getBlobUrl(config, qrPath);
}

export function syncFromCloud({ silent = false } = {}) {
  return async (dispatch, getState) => {
    if (!isConfigured) return;
    const { syncing } = getState().sync;
    if (syncing) return;

    dispatch(setSyncing(true));
    if (!silent) dispatch(setSyncStatus({ status: 'syncing', statusText: 'Cloud: Pulling...' }));

    try {
      const snapshot = await get(ref(db, DATA_PATH));
      if (!snapshot.exists()) {
        dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: No data yet' }));
        dispatch(setSyncing(false));
        return;
      }

      const cloudData = snapshot.val();
      dispatch(loadCloudState(cloudData));
      dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Updated (' + new Date().toLocaleTimeString() + ')' }));
      if (!silent) dispatch(toast('Synced from cloud!'));
    } catch (_e) {
      console.error('syncFromCloud error:', _e);
      dispatch(setSyncStatus({ status: 'disconnected', statusText: 'Cloud: Fetch failed' }));
    }

    dispatch(setSyncing(false));
  };
}

export function syncToCloud() {
  return async (dispatch, getState) => {
    if (!isConfigured) return;
    const { syncing } = getState().sync;
    if (syncing) return;

    dispatch(setSyncing(true));
    dispatch(setSyncStatus({ status: 'syncing', statusText: 'Cloud: Saving...' }));

    try {
      const merged = getCloudState(getState().trip);
      _skipNextListener = true;
      await update(ref(db, DATA_PATH), merged);

      dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Saved (' + new Date().toLocaleTimeString() + ')' }));
    } catch (_e) {
      _skipNextListener = false;
      console.error('syncToCloud error:', _e);
      dispatch(setSyncStatus({ status: 'disconnected', statusText: 'Cloud: Save failed' }));
    }

    dispatch(setSyncing(false));
  };
}

export async function fetchInitialData(dispatch) {
  if (!isConfigured) return;
  dispatch(setSyncing(true));
  try {
    const snapshot = await get(ref(db, DATA_PATH));
    if (snapshot.exists()) {
      dispatch(loadCloudState(snapshot.val()));
    }
    dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Ready' }));
  } catch (_e) {
    console.error('fetchInitialData error:', _e);
    dispatch(setSyncStatus({ status: 'disconnected', statusText: 'Cloud: Initial fetch failed' }));
  }
  dispatch(setSyncing(false));
}

let pushTimer = null;
let lastPushTime = 0;
const MIN_PUSH_INTERVAL = 2000;
const DEBOUNCE_DELAY = 1000;

export function debouncedPush(dispatch) {
  if (pushTimer) clearTimeout(pushTimer);
  const elapsed = Date.now() - lastPushTime;
  const delay = elapsed < MIN_PUSH_INTERVAL
    ? MIN_PUSH_INTERVAL - elapsed + DEBOUNCE_DELAY
    : DEBOUNCE_DELAY;
  pushTimer = setTimeout(() => {
    lastPushTime = Date.now();
    dispatch(syncToCloud());
  }, delay);
}

let unsubscribe = null;
let _skipNextListener = false;
let _onFirstLoad = null;

export function startAutoPolling(dispatch, onReady) {
  if (unsubscribe) { if (onReady) onReady(); return; }
  if (!isConfigured) { if (onReady) onReady(); return; }

  _onFirstLoad = onReady || null;

  unsubscribe = onValue(
    ref(db, DATA_PATH),
    (snapshot) => {
      if (_skipNextListener) {
        _skipNextListener = false;
        dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Saved (' + new Date().toLocaleTimeString() + ')' }));
        return;
      }
      if (!snapshot.exists()) {
        dispatch(clearAll());
        dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Empty (' + new Date().toLocaleTimeString() + ')' }));
      } else {
        dispatch(loadCloudState(snapshot.val()));
        dispatch(setSyncStatus({ status: 'connected', statusText: 'Cloud: Updated (' + new Date().toLocaleTimeString() + ')' }));
      }
      if (_onFirstLoad) { _onFirstLoad(); _onFirstLoad = null; }
    },
    (error) => {
      console.error('Firebase onValue error:', error);
      dispatch(setSyncStatus({ status: 'disconnected', statusText: 'Cloud: Listener error' }));
      if (_onFirstLoad) { _onFirstLoad(); _onFirstLoad = null; }
    },
  );
}

export function stopAutoPolling() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

const TOKENS_PATH = (import.meta.env.VITE_FIREBASE_DATA_PATH || 'trips/default') + '/tokens';

export async function fetchTokens() {
  if (!isConfigured) return {};
  const snapshot = await get(ref(db, TOKENS_PATH));
  return snapshot.exists() ? snapshot.val() : {};
}

export async function writeToken(hash, name) {
  if (!isConfigured) return;
  await set(ref(db, `${TOKENS_PATH}/${hash}`), { name, active: true });
}

export async function deactivateToken(hash) {
  if (!isConfigured) return;
  const snapshot = await get(ref(db, `${TOKENS_PATH}/${hash}`));
  if (snapshot.exists()) {
    const data = snapshot.val();
    await set(ref(db, `${TOKENS_PATH}/${hash}`), { ...data, active: false });
  }
}

export async function reactivateToken(hash) {
  if (!isConfigured) return;
  const snapshot = await get(ref(db, `${TOKENS_PATH}/${hash}`));
  if (snapshot.exists()) {
    const data = snapshot.val();
    await set(ref(db, `${TOKENS_PATH}/${hash}`), { ...data, active: true });
  }
}

export async function seedTokens(travelers, hashFn) {
  if (!isConfigured) return;
  const existing = await fetchTokens();
  if (Object.keys(existing).length > 0) return;
  for (const t of travelers) {
    const hash = await hashFn(t.name);
    await set(ref(db, `${TOKENS_PATH}/${hash}`), { name: t.name, active: true });
  }
}
