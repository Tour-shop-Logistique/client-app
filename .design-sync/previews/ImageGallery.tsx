import { ImageGallery } from 'client-app';

// Inline SVG product shots keep the capture deterministic (no network).
const shot = (from, to, label) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="270" r="120" fill="rgba(255,255,255,0.25)"/><text x="300" y="470" font-family="Poppins,Arial" font-size="40" font-weight="700" fill="white" text-anchor="middle">${label}</text></svg>`,
  );

const photos = [
  { id: 1, url: shot('#156fbe', '#159faf', 'Robe en wax') },
  { id: 2, url: shot('#a3b01e', '#159faf', 'Vue de dos') },
  { id: 3, url: shot('#363065', '#156fbe', 'Détail tissu') },
];

export const Galerie = () => (
  <div className="max-w-sm bg-white pb-3">
    <ImageGallery
      photos={photos}
      overlay={<span className="absolute left-3 top-3 rounded-full bg-shop-400 px-2.5 py-1 text-caption font-bold text-shop-950">Nouveau</span>}
    />
  </div>
);

export const SansPhoto = () => (
  <div className="max-w-sm">
    <ImageGallery photos={[]} />
  </div>
);
