import { createSlice } from '@reduxjs/toolkit';
import { loadJson } from '../persist';

// Une annonce marketplace est un article unique (pas de stock ni de quantite) :
// le panier est une liste d'annonces, envoyee telle quelle a panier/valider.
// Item : { id, titre, prix, devise, photo, vendeur: { id, nom, prenoms } }
export const CART_KEY = 'marketplace_cart';

const initialState = {
  items: loadJson(CART_KEY, []),
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action) {
      if (!state.items.some((item) => item.id === action.payload.id)) {
        state.items.push(action.payload);
      }
    },
    removeFromCart(state, action) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    // Retire les annonces transformees en commandes (ou devenues indisponibles).
    removeManyFromCart(state, action) {
      const ids = new Set(action.payload);
      state.items = state.items.filter((item) => !ids.has(item.id));
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addToCart, removeFromCart, removeManyFromCart, clearCart } = cartSlice.actions;
export const selectCartCount = (state) => state.cart.items.length;
export const selectInCart = (id) => (state) => state.cart.items.some((item) => item.id === id);
export default cartSlice.reducer;
