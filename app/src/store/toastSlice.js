import { createSlice } from '@reduxjs/toolkit';

let nextId = 0;

const toastSlice = createSlice({
  name: 'toast',
  initialState: { toasts: [] },
  reducers: {
    showToast(state, action) {
      const { message, type = 'success', undoId } = action.payload;
      state.toasts.push({ id: nextId++, message, type, undoId });
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload);
    },
  },
});

export const { showToast, dismissToast } = toastSlice.actions;

export const toast = (message, type = 'success', undoId) => (dispatch) => {
  const id = nextId;
  dispatch(showToast({ message, type, undoId }));
  setTimeout(() => dispatch(dismissToast(id)), undoId ? 6000 : 3000);
};

export default toastSlice.reducer;
