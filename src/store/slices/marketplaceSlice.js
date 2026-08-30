import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import marketplaceService from '../../services/marketplaceService';

export const fetchProducts = createAsyncThunk('marketplace/fetchProducts', async (params) => {
  return marketplaceService.listProducts(params);
});

const initialState = {
  products: [],
  status: 'idle',
  error: null,
};

const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'idle';
        state.products = action.payload.data ?? action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      });
  },
});

export default marketplaceSlice.reducer;
