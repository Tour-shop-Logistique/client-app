import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Opens the auth sheet. `reason` explains why it appeared (gates a major
  // action per cahier 4.1); `mode` is the starting screen:
  // login | register | verify | forgot | reset.
  authSheet: { open: false, reason: null, mode: 'login' },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openAuthSheet(state, action) {
      const payload = action.payload ?? {};
      const { reason = null, mode = 'login' } =
        typeof payload === 'string' ? { reason: payload } : payload;
      state.authSheet = { open: true, reason, mode };
    },
    setAuthSheetMode(state, action) {
      state.authSheet.mode = action.payload;
    },
    closeAuthSheet(state) {
      state.authSheet = { open: false, reason: null, mode: 'login' };
    },
  },
});

export const { openAuthSheet, setAuthSheetMode, closeAuthSheet } = uiSlice.actions;
export default uiSlice.reducer;
