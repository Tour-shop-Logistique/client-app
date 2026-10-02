# design-sync notes — client-app

- **Source is an app, not a library.** No dist/.d.ts; `.design-sync/ds-entry.js` is the hand-written barrel the converter bundles (`cfg.entry`). Add/remove components there AND in `componentSrcMap`. All props are hand-written in `cfg.dtsPropsFor` (plain JSX — keep them in sync with component signatures).
- **CSS:** run `buildCmd` before every converter run. It compiles `.design-sync/ds.css` (Google Fonts `@import` + `src/index.css`) with `.design-sync/tailwind.ds.config.js` (app theme; content = src + `.design-sync/**`) into `.design-sync/.cache/ds.css` (= `cfg.cssEntry`, gitignored).
- **Fonts:** Inter + Poppins from Google Fonts at runtime (`runtimeFontPrefixes`), same as `index.html`.
- **Provider:** `.design-sync/DsProvider.jsx` = MemoryRouter (TopBar/BottomNav use router hooks) + `#sheet-root` (BottomSheet portals into it, as `index.html` does). Children mount one tick later because BottomSheet calls `getElementById` during render.
- **Icons:** only the lucide icons the app imports are exported (list generated from `src/` — regenerate if the app starts using new ones), not the whole library.
- **Excluded (store/API/PWA-bound):** AuthSheet, ProductCard, CartButton, CountrySelectSheet, CitySelectSheet, AgencySelectSheet, AbonnementBanner, GuestGate, SellerOnly, InstallPrompt.
- **Fixed in source (2026-10-02, user-approved):** `DestinationCountrySheet.jsx` / `ProductSelectSheet.jsx` regexes used literal combining chars (U+0300-U+036F); a bundle served without a UTF-8 charset decodes them as Latin-1 and the whole `_ds_bundle.js` throws. Rewritten as backslash-u escapes (0300-036f). `CountrySelectSheet.jsx` (not synced) still has the raw form.
- **Animations in previews:** captures run before framer-motion entry animations finish (invisible DeliveryCodeCard, mid-count AnimatedNumber). Previews of animated components set `MotionGlobalConfig.skipAnimations = true` (exported from ds-entry, the bundle's own framer-motion copy). Designs keep their animations.
- **Flags:** country flag emojis render as letter pairs ("FR") in headless Chromium on Windows (no flag-emoji font) — environment limitation, real devices show flags. Known, not a bug.

## Re-sync risks
- `cfg.dtsPropsFor` is hand-written from the JSX signatures (2026-10-02) — any prop change in a synced component silently drifts the `.d.ts` until updated here.
- The lucide icon export list in `ds-entry.js` is a snapshot of the icons `src/` imported on 2026-10-02.
- The compiled CSS only contains classes used by `src/` + previews; `conventions.md` names a subset — re-validate it against `_ds_bundle.css` when the app's styling changes.
- Toolchain assumed: Node 24, tailwindcss 3.4 CLI, playwright 1.62.0 (pinned to cached chromium-1234).
- **Card modes:** every multi-example component uses `cardMode: column` (full-width rows) — the default grid clipped the mobile-width cards.
