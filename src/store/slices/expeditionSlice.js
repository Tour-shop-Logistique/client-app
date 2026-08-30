import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import expeditionService from '../../services/expeditionService';

// Page "Mes colis" — s'appuie sur l'API client documentée :
//   GET  /api/expedition/client/list        -> liste
//   PUT  /api/expedition/client/cancel/{id} -> annulation
//   GET  /api/expedition/client/statistics  -> compteurs

export const fetchExpeditions = createAsyncThunk(
  'expeditions/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await expeditionService.clientList(params);
      return res.data ?? [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Impossible de charger vos expéditions.');
    }
  }
);

export const fetchExpeditionStats = createAsyncThunk(
  'expeditions/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const res = await expeditionService.clientStatistics();
      return res.data ?? null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || null);
    }
  }
);

export const cancelExpedition = createAsyncThunk(
  'expeditions/cancel',
  async ({ id, motif }, { rejectWithValue }) => {
    try {
      const res = await expeditionService.clientCancel(id, motif);
      return res.data; // expédition mise à jour (statut cancelled, ...)
    } catch (err) {
      return rejectWithValue({
        message:
          err.response?.data?.message ||
          err.response?.data?.errors?.motif_annulation?.[0] ||
          "Impossible d'annuler cette expédition.",
        fieldErrors: err.response?.data?.errors || null,
      });
    }
  }
);

const initialState = {
  items: [],
  stats: null,
  status: 'idle', // idle | loading | error
  error: null,
  cancelStatus: 'idle', // idle | loading | error
  cancelError: null,
};

const expeditionSlice = createSlice({
  name: 'expeditions',
  initialState,
  reducers: {
    resetCancelState(state) {
      state.cancelStatus = 'idle';
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExpeditions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchExpeditions.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = Array.isArray(action.payload) ? action.payload : action.payload?.data ?? [];
      })
      .addCase(fetchExpeditions.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload || action.error.message;
      })

      .addCase(fetchExpeditionStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })

      .addCase(cancelExpedition.pending, (state) => {
        state.cancelStatus = 'loading';
        state.cancelError = null;
      })
      .addCase(cancelExpedition.fulfilled, (state, action) => {
        state.cancelStatus = 'idle';
        const updated = action.payload;
        if (updated?.id) {
          const i = state.items.findIndex((e) => e.id === updated.id);
          if (i !== -1) state.items[i] = { ...state.items[i], ...updated };
        }
      })
      .addCase(cancelExpedition.rejected, (state, action) => {
        state.cancelStatus = 'error';
        state.cancelError = action.payload?.message || "Impossible d'annuler cette expédition.";
      });
  },
});

export const { resetCancelState } = expeditionSlice.actions;
export default expeditionSlice.reducer;
