import { createSlice } from '@reduxjs/toolkit';
import { getCountryName, isValidCountryCode } from '../../utils/countries';

const STORAGE_KEY = 'country_code';

// The app is guest-first (see authSlice): browsing never requires an account,
// so we can't infer the user's country from a profile. We ask for it once
// (e.g. before listing agencies) and remember the choice in localStorage.
const storedCode = localStorage.getItem(STORAGE_KEY);

const initialState = {
  code: isValidCountryCode(storedCode) ? storedCode.toUpperCase() : null,
  name: isValidCountryCode(storedCode) ? getCountryName(storedCode) : null,
};

const countrySlice = createSlice({
  name: 'country',
  initialState,
  reducers: {
    setCountry(state, action) {
      const code = action.payload?.toUpperCase();
      if (!isValidCountryCode(code)) return;
      state.code = code;
      state.name = getCountryName(code);
      localStorage.setItem(STORAGE_KEY, code);
    },
    clearCountry(state) {
      state.code = null;
      state.name = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { setCountry, clearCountry } = countrySlice.actions;
export default countrySlice.reducer;
