import { createSlice } from '@reduxjs/toolkit';
import { isConfigured } from '../utils/firebase';

const syncSlice = createSlice({
  name: 'sync',
  initialState: {
    account: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT || '',
    sasToken: import.meta.env.VITE_AZURE_SAS_TOKEN || '',
    status: isConfigured ? 'connected' : 'disconnected',
    statusText: isConfigured ? 'Cloud: Ready' : 'Cloud: Not configured (check .env)',
    syncing: false,
  },
  reducers: {
    setSyncStatus(state, action) {
      const { status, statusText } = action.payload;
      state.status = status;
      state.statusText = statusText;
    },
    setSyncing(state, action) {
      state.syncing = action.payload;
    },
  },
});

export const { setSyncStatus, setSyncing } = syncSlice.actions;
export default syncSlice.reducer;
