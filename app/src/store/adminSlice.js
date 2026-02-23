import { createSlice } from '@reduxjs/toolkit';

const ADMIN_TTL = 5 * 60 * 1000;
const LOCKOUT_TTL = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function loadLockout() {
  try {
    const s = localStorage.getItem('adminLockout');
    if (s) {
      const { failedAttempts, lockedOutAt } = JSON.parse(s);
      if (lockedOutAt && Date.now() - lockedOutAt < LOCKOUT_TTL) {
        return { failedAttempts, lockedOutAt };
      }
      if (failedAttempts > 0 && !lockedOutAt) {
        return { failedAttempts, lockedOutAt: null };
      }
    }
  } catch (e) {}
  return { failedAttempts: 0, lockedOutAt: null };
}

const adminSlice = createSlice({
  name: 'admin',
  initialState: {
    unlockedAt: null,
    ...loadLockout(),
  },
  reducers: {
    unlock(state) {
      state.unlockedAt = Date.now();
      state.failedAttempts = 0;
      state.lockedOutAt = null;
    },
    lock(state) {
      state.unlockedAt = null;
    },
    incrementAttempts(state) {
      state.failedAttempts += 1;
      if (state.failedAttempts >= MAX_ATTEMPTS) {
        state.lockedOutAt = Date.now();
      }
    },
    resetLockout(state) {
      state.failedAttempts = 0;
      state.lockedOutAt = null;
    },
  },
});

export const { unlock, lock, incrementAttempts, resetLockout } = adminSlice.actions;

export const selectIsAdmin = (state) => {
  const { unlockedAt } = state.admin;
  if (!unlockedAt) return false;
  return Date.now() - unlockedAt < ADMIN_TTL;
};

export const selectAdminExpiry = (state) => {
  const { unlockedAt } = state.admin;
  if (!unlockedAt) return 0;
  const remaining = ADMIN_TTL - (Date.now() - unlockedAt);
  return remaining > 0 ? remaining : 0;
};

export const selectIsLockedOut = (state) => {
  const { lockedOutAt } = state.admin;
  if (!lockedOutAt) return false;
  return Date.now() - lockedOutAt < LOCKOUT_TTL;
};

export const selectLockoutExpiry = (state) => {
  const { lockedOutAt } = state.admin;
  if (!lockedOutAt) return 0;
  const remaining = LOCKOUT_TTL - (Date.now() - lockedOutAt);
  return remaining > 0 ? remaining : 0;
};

export default adminSlice.reducer;
