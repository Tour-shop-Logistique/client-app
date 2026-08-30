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
  expeditionHistory: true,    // GET /list + PUT /cancel/{id} + GET /statistics (documented)
  agencies: true,             // GET /api/agences, GET /api/agences/{id}      (documented)
  profile: true,              // GET /api/profil + auth flow                  (documented)

  // --- Not connected yet ------------------------------------------------
  // Endpoints /expeditions/interville/estimation + /expeditions/interville
  // are not in any API doc.
  expeditionInterville: false,

  // Delivery-offer / confirm-delivery / rating / invoice-download endpoints
  // (/expeditions/{id}/...) are not documented; client API only exposes
  // show / list / cancel / statistics.
  expeditionTracking: false,

  // No /marketplace/* endpoint is documented anywhere.
  marketplace: false,

  // No /parrainage/* endpoint is documented.
  referral: false,

  // Depends on /expeditions/{id}/facture (undocumented).
  invoices: false,
};

export const isFeatureReady = (key) => FEATURES[key] !== false;
