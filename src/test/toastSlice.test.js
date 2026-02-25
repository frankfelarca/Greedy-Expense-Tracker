import { describe, it, expect, beforeEach, vi } from 'vitest';
import toastReducer, { showToast, dismissToast, toast } from '../store/toastSlice';

const initialState = () => toastReducer(undefined, { type: '@@INIT' });

describe('toastSlice', () => {
  let state;
  beforeEach(() => { state = initialState(); });

  describe('showToast', () => {
    it('adds a toast with message and type', () => {
      state = toastReducer(state, showToast({ message: 'Hello', type: 'success' }));
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].message).toBe('Hello');
      expect(state.toasts[0].type).toBe('success');
    });

    it('defaults type to success', () => {
      state = toastReducer(state, showToast({ message: 'Hi' }));
      expect(state.toasts[0].type).toBe('success');
    });

    it('assigns sequential ids', () => {
      state = toastReducer(state, showToast({ message: 'A' }));
      state = toastReducer(state, showToast({ message: 'B' }));
      expect(state.toasts[0].id).not.toBe(state.toasts[1].id);
    });

    it('includes undoId when provided', () => {
      state = toastReducer(state, showToast({ message: 'Deleted', undoId: 'undo-123' }));
      expect(state.toasts[0].undoId).toBe('undo-123');
    });
  });

  describe('dismissToast', () => {
    it('removes toast by id', () => {
      state = toastReducer(state, showToast({ message: 'A' }));
      const id = state.toasts[0].id;
      state = toastReducer(state, dismissToast(id));
      expect(state.toasts).toHaveLength(0);
    });

    it('does nothing for non-existent id', () => {
      state = toastReducer(state, showToast({ message: 'A' }));
      state = toastReducer(state, dismissToast(999));
      expect(state.toasts).toHaveLength(1);
    });

    it('only removes the targeted toast', () => {
      state = toastReducer(state, showToast({ message: 'A' }));
      state = toastReducer(state, showToast({ message: 'B' }));
      const id = state.toasts[0].id;
      state = toastReducer(state, dismissToast(id));
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].message).toBe('B');
    });
  });

  describe('toast thunk', () => {
    it('dispatches showToast', () => {
      const dispatched = [];
      const dispatch = (action) => {
        if (typeof action === 'function') return action(dispatch);
        dispatched.push(action);
      };
      toast('Test message', 'error')(dispatch);
      expect(dispatched.length).toBeGreaterThanOrEqual(1);
      expect(dispatched[0].type).toBe('toast/showToast');
      expect(dispatched[0].payload.message).toBe('Test message');
      expect(dispatched[0].payload.type).toBe('error');
    });

    it('auto-dismisses after timeout', () => {
      vi.useFakeTimers();
      const dispatched = [];
      const dispatch = (action) => {
        if (typeof action === 'function') return action(dispatch);
        dispatched.push(action);
      };
      toast('Auto dismiss')(dispatch);
      expect(dispatched).toHaveLength(1);
      vi.advanceTimersByTime(3100);
      expect(dispatched).toHaveLength(2);
      expect(dispatched[1].type).toBe('toast/dismissToast');
      vi.useRealTimers();
    });

    it('uses longer timeout for undo toasts', () => {
      vi.useFakeTimers();
      const dispatched = [];
      const dispatch = (action) => {
        if (typeof action === 'function') return action(dispatch);
        dispatched.push(action);
      };
      toast('Deleted', 'success', 'undo-1')(dispatch);
      vi.advanceTimersByTime(3100);
      expect(dispatched).toHaveLength(1);
      vi.advanceTimersByTime(3100);
      expect(dispatched).toHaveLength(2);
      vi.useRealTimers();
    });
  });
});
