# TourShop Client — conventions

Mobile-first customer app (parcel shipping + marketplace), French UI copy, amounts in FCFA. Design phone screens (`max-w-md` column) unless told otherwise.

## Setup — always wrap in `DsProvider`

```jsx
const { DsProvider, TopBar, BottomNav } = window.TousShopClient;

<DsProvider>
  <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface-50">
    <TopBar title="Mes colis" back />
    <main className="page-container space-y-4 py-4">…</main>
    <BottomNav />
  </div>
</DsProvider>
```

`DsProvider` supplies the router (`TopBar`, `BottomNav` use router hooks — they crash without it) and the `#sheet-root` node that `BottomSheet`, `DestinationCountrySheet` and `ProductSelectSheet` portal into (without it, sheets render nothing). `BottomNav` is `position: fixed` at the bottom — leave ~5rem bottom padding on the scrolling content (e.g. `style={{ paddingBottom: 88 }}`).

## Styling — Tailwind utilities + a few component classes

The stylesheet is the app's compiled Tailwind: **only classes the app already uses exist**. Stick to this vocabulary:

| Purpose | Classes |
|---|---|
| Buttons | `btn-primary` (blue fill), `btn-secondary`, `btn-ghost`, `btn-shop` (lime, marketplace CTAs) |
| Surfaces | `card` (white, `rounded-2xl`, `shadow-card`), `brand-gradient` (navy→blue→teal hero), `shop-gradient` |
| Form | `input-field` (text inputs/selects), `chip` / `chip-active` (filter pills) |
| Layout | `page-container` (page gutter), `no-scrollbar` (horizontal scrollers) |
| Text | `text-caption` 12px, `text-body` 14px, `text-title` 18px/600, `text-display` 24px/700; headings `font-heading` (Poppins), body Inter |
| Colors | neutrals `surface-50…950` (`bg-surface-50` page, `text-surface-900` ink, `text-surface-500` muted); brand `primary-50…950` (blue, e.g. `bg-primary-600`, `bg-primary-50 text-primary-700`); marketplace accent `shop-*` (`bg-shop-400 text-shop-950`); status `emerald` / `amber` / `red` |

Icons: lucide components exported on the same global (`Package`, `Truck`, `MapPin`, `Wallet`, `ShoppingBag`, `Search`, `ChevronLeft`, …) — pass the component to `icon` props, or render `<Package size={18} />`.

## Where the truth lives

- `styles.css` → `_ds_bundle.css`: every available class and the theme values.
- `components/<group>/<Name>/<Name>.d.ts` for props, `<Name>.prompt.md` for usage examples.
- `StatusBadge` takes a dictionary from the global: `COMMANDE_STATUTS`, `LIVRAISON_STATUTS`, `ANNONCE_STATUTS`, `ECHEANCE_STATUTS`, `PAIEMENT_ABONNEMENT_STATUTS`.

## Example

```jsx
const { DsProvider, TopBar, StepProgress, ContactFields, OrderItemsCard, StatusBadge, COMMANDE_STATUTS } = window.TousShopClient;

<DsProvider>
  <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface-50">
    <TopBar title="Nouvelle expédition" back />
    <main className="page-container space-y-4 py-4">
      <StepProgress step={3} total={5} labels={['Trajet', 'Colis', 'Expéditeur', 'Destinataire', 'Récapitulatif']} />
      <ContactFields title="Expéditeur" data={contact} onChange={setContact} />
      <div className="card flex items-center justify-between p-4">
        <p className="text-body font-semibold text-surface-900">Commande #1042</p>
        <StatusBadge map={COMMANDE_STATUTS} value="payee" />
      </div>
      <button className="btn-primary w-full">Continuer</button>
    </main>
  </div>
</DsProvider>
```
