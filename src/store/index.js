import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer, { CART_KEY } from './slices/cartSlice';
import uiReducer from './slices/uiSlice';
import expeditionReducer from './slices/expeditionSlice';
import marketplaceReducer, { FAVORITES_KEY, RECENT_KEY } from './slices/marketplaceSlice';
import agencyReducer from './slices/agencySlice';
import countryReducer from './slices/countrySlice';
import { saveJson } from './persist';

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

// Persiste panier / favoris / vus recemment, uniquement quand ils changent.
let previous = {};
store.subscribe(() => {
  const state = store.getState();
  const next = {
    [CART_KEY]: state.cart.items,
    [FAVORITES_KEY]: state.marketplace.favorites,
    [RECENT_KEY]: state.marketplace.recent,
  };
  Object.entries(next).forEach(([key, value]) => {
    if (previous[key] !== value) saveJson(key, value);
  });
  previous = next;
});
