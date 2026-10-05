// Feature availability registry.
//
// The client app was built ahead of the backend. Only the endpoints documented
// in the repo (`api-authentification-client.md`, `api-devis-client.md`,
// `api-enregistrement-expedition-client.md`) are known to exist and work; every
// other service call targets a guessed URL.
//
// A feature marked `false` renders <PageUnavailable /> instead of its page(s).
// Flip it to `true` once its endpoints are wired to the real backend and tested.
//
//   ready  -> backend endpoints exist (documented) and the screen uses them
//   false  -> no real backend yet (placeholder / guessed URLs)

export const FEATURES = {
  // --- Ready -------------------------------------------------------------
  home: true,                 // static content, no backend
  expeditionNew: true,        // static chooser (interville vs extrapays)
  expeditionExtrapays: true,  // POST /api/expedition/client/devis + /store  (documented)
  expeditionInterville: true, // GET /communes + /formats-colis + POST /simulate-interville + /store (documented)
  expeditionHistory: true,    // GET /list + PUT /cancel/{id} + GET /statistics (documented)
  agencies: true,             // GET /api/agences, GET /api/agences/{id}      (documented)
  profile: true,              // GET /api/profil + auth flow                  (documented)
  referral: true,             // GET /api/client/parrainage/*  (mon-code, solde, historique, filleuls) (documented)
  marketplace: true,          // /marketplace/acheteur|vendeur/*, /marketplace/solde, /abonnement/* (MARKETPLACE_ET_ABONNEMENT_API.md)
  // Suivi, missions/offres/preuves et evaluation sont dans le detail d'expedition
  // (feature expeditionHistory) — REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md.
  invoices: true,             // GET /expedition/client/factures + /factures/{id}/download (documented)
};

export const isFeatureReady = (key) => FEATURES[key] !== false;
