import { describe, it, expect, beforeEach, vi } from 'vitest';
import adminReducer, {
  unlock, lock, incrementAttempts, resetLockout,
  selectIsAdmin, selectAdminExpiry, selectIsLockedOut, selectLockoutExpiry,
} from '../store/adminSlice';

const initialState = () => adminReducer(undefined, { type: '@@INIT' });
const wrapState = (admin) => ({ admin });

describe('adminSlice', () => {
  let state;
  beforeEach(() => { state = initialState(); });

  describe('unlock', () => {
    it('sets unlockedAt and resets attempts', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, unlock());
      expect(state.unlockedAt).toBeGreaterThan(0);
      expect(state.failedAttempts).toBe(0);
      expect(state.lockedOutAt).toBeNull();
    });
  });

  describe('lock', () => {
    it('clears unlockedAt', () => {
      state = adminReducer(state, unlock());
      state = adminReducer(state, lock());
      expect(state.unlockedAt).toBeNull();
    });
  });

  describe('incrementAttempts', () => {
    it('increments failed attempts', () => {
      state = adminReducer(state, incrementAttempts());
      expect(state.failedAttempts).toBe(1);
      state = adminReducer(state, incrementAttempts());
      expect(state.failedAttempts).toBe(2);
    });

    it('locks out after 3 attempts', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      expect(state.lockedOutAt).toBeGreaterThan(0);
    });

    it('does not lock out before 3 attempts', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      expect(state.lockedOutAt).toBeNull();
    });
  });

  describe('resetLockout', () => {
    it('resets attempts and lockout', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, resetLockout());
      expect(state.failedAttempts).toBe(0);
      expect(state.lockedOutAt).toBeNull();
    });
  });

  describe('selectIsAdmin', () => {
    it('returns false when not unlocked', () => {
      expect(selectIsAdmin(wrapState(state))).toBe(false);
    });

    it('returns true when recently unlocked', () => {
      state = adminReducer(state, unlock());
      expect(selectIsAdmin(wrapState(state))).toBe(true);
    });

    it('returns false when unlocked long ago (expired)', () => {
      state = adminReducer(state, unlock());
      const expired = { ...state, unlockedAt: Date.now() - 6 * 60 * 1000 };
      expect(selectIsAdmin(wrapState(expired))).toBe(false);
    });
  });

  describe('selectAdminExpiry', () => {
    it('returns 0 when not unlocked', () => {
      expect(selectAdminExpiry(wrapState(state))).toBe(0);
    });

    it('returns remaining time when unlocked', () => {
      state = adminReducer(state, unlock());
      const expiry = selectAdminExpiry(wrapState(state));
      expect(expiry).toBeGreaterThan(0);
      expect(expiry).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('returns 0 when expired', () => {
      const expired = { ...state, unlockedAt: Date.now() - 6 * 60 * 1000 };
      expect(selectAdminExpiry(wrapState(expired))).toBe(0);
    });
  });

  describe('selectIsLockedOut', () => {
    it('returns false when not locked out', () => {
      expect(selectIsLockedOut(wrapState(state))).toBe(false);
    });

    it('returns true when recently locked out', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      expect(selectIsLockedOut(wrapState(state))).toBe(true);
    });

    it('returns false when lockout expired', () => {
      const expired = { ...state, lockedOutAt: Date.now() - 6 * 60 * 1000 };
      expect(selectIsLockedOut(wrapState(expired))).toBe(false);
    });
  });

  describe('selectLockoutExpiry', () => {
    it('returns 0 when not locked out', () => {
      expect(selectLockoutExpiry(wrapState(state))).toBe(0);
    });

    it('returns remaining time when locked out', () => {
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      state = adminReducer(state, incrementAttempts());
      const expiry = selectLockoutExpiry(wrapState(state));
      expect(expiry).toBeGreaterThan(0);
      expect(expiry).toBeLessThanOrEqual(5 * 60 * 1000);
    });
  });
});
