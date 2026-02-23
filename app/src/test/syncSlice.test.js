import { describe, it, expect, beforeEach } from 'vitest';

vi.mock('../utils/firebase', () => ({ isConfigured: false }));

const { default: syncReducer, setSyncStatus, setSyncing } = await import('../store/syncSlice');

const initialState = () => syncReducer(undefined, { type: '@@INIT' });

describe('syncSlice', () => {
  let state;
  beforeEach(() => { state = initialState(); });

  describe('setSyncStatus', () => {
    it('updates status and statusText', () => {
      state = syncReducer(state, setSyncStatus({ status: 'syncing', statusText: 'Cloud: Saving...' }));
      expect(state.status).toBe('syncing');
      expect(state.statusText).toBe('Cloud: Saving...');
    });

    it('can set disconnected', () => {
      state = syncReducer(state, setSyncStatus({ status: 'disconnected', statusText: 'Cloud: Error' }));
      expect(state.status).toBe('disconnected');
    });
  });

  describe('setSyncing', () => {
    it('sets syncing to true', () => {
      state = syncReducer(state, setSyncing(true));
      expect(state.syncing).toBe(true);
    });

    it('sets syncing to false', () => {
      state = syncReducer(state, setSyncing(true));
      state = syncReducer(state, setSyncing(false));
      expect(state.syncing).toBe(false);
    });
  });

  describe('initial state', () => {
    it('starts with disconnected when firebase not configured', () => {
      expect(state.status).toBe('disconnected');
      expect(state.syncing).toBe(false);
    });
  });
});
