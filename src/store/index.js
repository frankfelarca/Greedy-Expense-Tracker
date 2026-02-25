import { configureStore } from '@reduxjs/toolkit';
import tripReducer from './tripSlice';
import toastReducer from './toastSlice';
import syncReducer from './syncSlice';
import adminReducer from './adminSlice';
import { debouncedPush } from '../utils/sync';

const localStorageMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  if (action.type?.startsWith('trip/')) {
    const { tripName, tripDestination, tripStart, tripEnd } = store.getState().trip;
    localStorage.setItem('travelExpenseState', JSON.stringify({ tripName, tripDestination, tripStart, tripEnd }));

    if (action.type !== 'trip/loadCloudState' && action.type !== 'trip/clearAll') {
      debouncedPush(store.dispatch);
    }
  }
  if (action.type?.startsWith('admin/')) {
    const { failedAttempts, lockedOutAt } = store.getState().admin;
    localStorage.setItem('adminLockout', JSON.stringify({ failedAttempts, lockedOutAt }));
  }
  return result;
};

export const store = configureStore({
  reducer: {
    trip: tripReducer,
    toast: toastReducer,
    sync: syncReducer,
    admin: adminReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }).concat(localStorageMiddleware),
});
