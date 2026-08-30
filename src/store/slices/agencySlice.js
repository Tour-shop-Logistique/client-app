import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import agencyService from '../../services/agencyService';

export const fetchAgencies = createAsyncThunk('agencies/fetchAll', async (params) => {
  return agencyService.list(params);
});

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

const agencySlice = createSlice({
  name: 'agencies',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgencies.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAgencies.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload.agences ?? [];
      })
      .addCase(fetchAgencies.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      });
  },
});

export default agencySlice.reducer;
