import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import marketplaceService from '../../services/marketplaceService';
import abonnementService from '../../services/abonnementService';
import { loadJson } from '../persist';
import { annonceCover } from '../../utils/marketplace';

export const FAVORITES_KEY = 'marketplace_favorites';
export const RECENT_KEY = 'marketplace_recent';
const RECENT_MAX = 12;
export const PER_PAGE = 20;

// GET catalogue/list. `append` = page suivante (scroll infini) ; sinon on
// remplace la liste (nouvelle recherche / rafraichissement).
export const fetchCatalogue = createAsyncThunk(
  'marketplace/fetchCatalogue',
  async ({ recherche = '', page = 1, codePays, append = false } = {}) => {
    const params = { page, per_page: PER_PAGE };
    if (recherche.trim()) params.recherche = recherche.trim();
    if (codePays) params.code_pays = codePays;
    const annonces = await marketplaceService.catalogue(params);
    return { annonces, append, recherche };
  }
);

export const fetchAbonnementStatut = createAsyncThunk('marketplace/fetchAbonnementStatut', () =>
  abonnementService.statut()
);

// Snapshot minimal d'une annonce pour le panier / les favoris / l'historique.
export const annonceSnapshot = (annonce) => ({
  id: annonce.id,
  titre: annonce.titre,
  prix: Number(annonce.prix),
  devise: annonce.devise || 'XOF',
  photo: annonceCover(annonce),
  vendeur: annonce.vendeur
    ? { id: annonce.vendeur.id, nom: annonce.vendeur.nom, prenoms: annonce.vendeur.prenoms }
    : null,
});

const initialState = {
  catalogue: {
    items: [],
    page: 0,
    lastPage: 1,
    total: 0,
    recherche: '',
    status: 'idle', // idle | loading | loadingMore | error
    error: null,
  },
  favorites: loadJson(FAVORITES_KEY, []),
  recent: loadJson(RECENT_KEY, []),
  abonnement: {
    loaded: false,
    abonnement: null,
    echeanceCourante: null,
    bloque: false,
  },
};

const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState,
  reducers: {
    toggleFavorite(state, action) {
      const snap = action.payload;
      const exists = state.favorites.some((f) => f.id === snap.id);
      state.favorites = exists ? state.favorites.filter((f) => f.id !== snap.id) : [snap, ...state.favorites];
    },
    pushRecent(state, action) {
      const snap = action.payload;
      state.recent = [snap, ...state.recent.filter((r) => r.id !== snap.id)].slice(0, RECENT_MAX);
    },
    // Une annonce vendue/indisponible : on la retire du catalogue en memoire.
    dropFromCatalogue(state, action) {
      const ids = new Set(action.payload);
      state.catalogue.items = state.catalogue.items.filter((a) => !ids.has(a.id));
    },
    // Declenche par l'intercepteur api.js sur un 403 ABONNEMENT_BLOQUE.
    abonnementBloqueDetected(state) {
      state.abonnement.bloque = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalogue.pending, (state, action) => {
        state.catalogue.status = action.meta.arg?.append ? 'loadingMore' : 'loading';
        state.catalogue.error = null;
      })
      .addCase(fetchCatalogue.fulfilled, (state, action) => {
        const { annonces, append, recherche } = action.payload;
        const data = annonces?.data ?? [];
        if (append) {
          const known = new Set(state.catalogue.items.map((a) => a.id));
          state.catalogue.items.push(...data.filter((a) => !known.has(a.id)));
        } else {
          state.catalogue.items = data;
        }
        state.catalogue.page = annonces?.current_page ?? 1;
        state.catalogue.lastPage = annonces?.last_page ?? 1;
        state.catalogue.total = annonces?.total ?? data.length;
        state.catalogue.recherche = recherche;
        state.catalogue.status = 'idle';
      })
      .addCase(fetchCatalogue.rejected, (state, action) => {
        state.catalogue.status = 'error';
        state.catalogue.error = action.error.message;
      })
      .addCase(fetchAbonnementStatut.fulfilled, (state, action) => {
        state.abonnement = { loaded: true, ...action.payload };
      })
      .addCase(fetchAbonnementStatut.rejected, (state) => {
        state.abonnement.loaded = true;
      });
  },
});

export const { toggleFavorite, pushRecent, dropFromCatalogue, abonnementBloqueDetected } = marketplaceSlice.actions;
export default marketplaceSlice.reducer;
