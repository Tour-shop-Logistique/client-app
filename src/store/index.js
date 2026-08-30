import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import uiReducer from './slices/uiSlice';
import expeditionReducer from './slices/expeditionSlice';
import marketplaceReducer from './slices/marketplaceSlice';
import agencyReducer from './slices/agencySlice';
import countryReducer from './slices/countrySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer,
    expeditions: expeditionReducer,
    marketplace: marketplaceReducer,
    agencies: agencyReducer,
    country: countryReducer,
  },
});
