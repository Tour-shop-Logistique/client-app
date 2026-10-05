// Illustrations SVG du kit visuel TourShop (maquettes « Refonte design app
// client »). Décoratives : toutes portent aria-hidden, le texte voisin porte
// l'information. Couleurs = palette de tailwind.config.js (+ tons carton).

const KRAFT = { top: '#f0c88d', left: '#dba25c', right: '#c4873f' };

// Carton isométrique réutilisé partout (héros, tailles, états vides, succès).
export function BoxArt({ size = 64, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <ellipse cx="32" cy="60" rx="26" ry="3.5" fill="#0f172a" fillOpacity="0.12" />
      <path d="M32 4 60 16 32 28 4 16Z" fill={KRAFT.top} />
      <path d="M4 16 32 28v30L4 46Z" fill={KRAFT.left} />
      <path d="M60 16 32 28v30l28-12Z" fill={KRAFT.right} />
      <path d="M18 10 46 22v8" stroke="#fff" strokeOpacity="0.75" strokeWidth="4" />
    </svg>
  );
}

// Héros de l'accueil : globe, trajet pointillé, carton et épingle.
export function HeroGlobeArt({ className = '' }) {
  return (
    <svg width="170" height="150" viewBox="0 0 170 150" fill="none" aria-hidden="true" className={className}>
      <circle cx="100" cy="66" r="52" fill="#fff" fillOpacity="0.08" />
      <circle cx="100" cy="66" r="52" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.5" />
      <ellipse cx="100" cy="66" rx="22" ry="52" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M48 66h104M56 40h88M56 92h88" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M30 118C52 76 104 50 142 24" stroke="#d2e052" strokeWidth="2.4" strokeDasharray="5 6" strokeLinecap="round" />
      <g transform="translate(12 84)">
        <ellipse cx="32" cy="60" rx="30" ry="5" fill="#000" fillOpacity="0.18" />
        <path d="M32 0 64 14 32 28 0 14Z" fill={KRAFT.top} />
        <path d="M0 14 32 28v30L0 44Z" fill={KRAFT.left} />
        <path d="M64 14 32 28v30l32-14Z" fill={KRAFT.right} />
        <path d="M16 7 48 21v9" stroke="#fff" strokeOpacity="0.7" strokeWidth="4" />
      </g>
      <g transform="translate(128 0)">
        <path d="M14 0a14 14 0 0 1 14 14c0 10.5-14 26-14 26S0 24.5 0 14A14 14 0 0 1 14 0Z" fill="#bdce2e" />
        <circle cx="14" cy="14" r="5.5" fill="#24270a" />
      </g>
    </svg>
  );
}

export function PaperPlaneArt({ className = '' }) {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80" fill="none" aria-hidden="true" className={className}>
      <path d="M6 70C20 64 30 56 40 44" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      <path d="M40 44 90 6 70 62 56 46Z" fill="#fff" />
      <path d="M56 46 90 6" stroke="#47a3eb" strokeWidth="2" />
      <path d="M56 46 58 62 70 62Z" fill="#b7ddfa" />
    </svg>
  );
}

export function ShopBagArt({ className = '', size = 84 }) {
  return (
    <svg width={size} height={size * (86 / 84)} viewBox="0 0 84 86" fill="none" aria-hidden="true" className={className}>
      <path d="M30 30v-6a12 12 0 0 1 24 0v6" stroke="#24270a" strokeWidth="4" strokeLinecap="round" />
      <path d="M14 30h56l-5 44a6 6 0 0 1-6 5H25a6 6 0 0 1-6-5Z" fill="#fff" />
      <path d="M14 30h56l-1 9H15Z" fill="#24270a" fillOpacity="0.1" />
      <circle cx="42" cy="56" r="9" fill="#bdce2e" />
      <path d="m38 56 3 3 5-6" stroke="#24270a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff" />
    </svg>
  );
}

export function GiftArt({ className = '' }) {
  return (
    <svg width="104" height="100" viewBox="0 0 104 100" fill="none" aria-hidden="true" className={className}>
      <rect x="18" y="40" width="64" height="52" rx="8" fill="#f97316" />
      <rect x="12" y="28" width="76" height="18" rx="6" fill="#fb923c" />
      <rect x="44" y="28" width="12" height="64" fill="#bdce2e" />
      <path d="M50 28c-8-14-24-14-22-4 1 5 12 4 22 4Zm0 0c8-14 24-14 22-4-1 5-12 4-22 4Z" fill="#d2e052" />
      <circle cx="90" cy="18" r="9" fill="#fbbf24" />
      <circle cx="90" cy="18" r="5" fill="#f59e0b" />
      <circle cx="8" cy="70" r="6" fill="#fbbf24" />
    </svg>
  );
}

// Bandeau « plan de ville » avec trajet vers une épingle (carte agences).
export function MiniMapArt({ className = '' }) {
  return (
    <svg viewBox="0 0 350 96" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className={className}>
      <rect width="350" height="96" fill="#e7eef5" />
      <ellipse cx="60" cy="70" rx="56" ry="26" fill="#d4ebd8" />
      <path d="M0 40h350M120 0v96M250 0v96M0 82h350" stroke="#fff" strokeWidth="8" />
      <path d="M180 0 140 96" stroke="#fff" strokeWidth="5" />
      <path d="M300 60c-30 0-40-20-60-20s-40 0-60 30" stroke="#10808d" strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" />
      <circle cx="300" cy="60" r="7" fill="#156fbe" stroke="#fff" strokeWidth="3" />
      <g transform="translate(166 30)">
        <path d="M14 0a14 14 0 0 1 14 14c0 10.5-14 26-14 26S0 24.5 0 14A14 14 0 0 1 14 0Z" fill="#10808d" />
        <circle cx="14" cy="14" r="5.5" fill="#fff" />
      </g>
    </svg>
  );
}

// État vide « aucun colis » : carton ouvert + loupe.
export function EmptyParcelArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#eff7fe" />
      <ellipse cx="80" cy="118" rx="44" ry="6" fill="#0f172a" fillOpacity="0.1" />
      <path d="M40 56 80 72v42L40 98Z" fill={KRAFT.left} />
      <path d="M120 56 80 72v42l40-16Z" fill={KRAFT.right} />
      <path d="M40 56 80 72 66 88 26 72Z" fill={KRAFT.top} />
      <path d="M120 56 80 72l14 16 40-16Z" fill="#e6b26f" />
      <circle cx="128" cy="38" r="16" stroke="#156fbe" strokeWidth="5" fill="#fff" />
      <path d="m140 50 12 12" stroke="#156fbe" strokeWidth="6" strokeLinecap="round" />
      <path d="M28 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#bdce2e" />
    </svg>
  );
}

// État vide « panier » : sac qui sourit.
export function EmptyCartArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#fafbe7" />
      <ellipse cx="85" cy="118" rx="40" ry="6" fill="#0f172a" fillOpacity="0.1" />
      <path d="M68 46v-8a17 17 0 0 1 34 0v8" stroke="#24270a" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 46h74l-6 60a7 7 0 0 1-7 6H61a7 7 0 0 1-7-6Z" fill="#bdce2e" />
      <path d="M48 46h74l-1 11H49Z" fill="#a3b01e" />
      <circle cx="74" cy="78" r="3" fill="#24270a" />
      <circle cx="96" cy="78" r="3" fill="#24270a" />
      <path d="M76 94c5-4 13-4 18 0" stroke="#24270a" strokeWidth="3" strokeLinecap="round" />
      <path d="M138 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#156fbe" />
    </svg>
  );
}

// État vide « favoris » : cœur dans une bulle.
export function EmptyHeartArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#fdecef" />
      <ellipse cx="85" cy="118" rx="36" ry="6" fill="#0f172a" fillOpacity="0.1" />
      <path d="M85 104 52 72a20 20 0 0 1 33-24 20 20 0 0 1 33 24Z" fill="#f43f5e" />
      <path d="M62 60a10 10 0 0 1 10-8" stroke="#fff" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" />
      <path d="M134 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#bdce2e" />
      <path d="M32 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#156fbe" />
    </svg>
  );
}

// État vide « adresses » : plan avec épingle et maison.
export function EmptyAddressArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#edfbfc" />
      <path d="M30 96 62 82l46 14 32-14v-44l-32 14-46-14-32 14Z" fill="#fff" stroke="#a9eaf0" strokeWidth="2" />
      <path d="M62 38v44M108 52v44" stroke="#a9eaf0" strokeWidth="2" />
      <path d="M40 76c14-4 22-18 40-14s28-4 44-14" stroke="#10808d" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
      <g transform="translate(70 14)">
        <path d="M15 0a15 15 0 0 1 15 15c0 11-15 28-15 28S0 26 0 15A15 15 0 0 1 15 0Z" fill="#10808d" />
        <path d="M9 17v-4l6-5 6 5v4Z" fill="#fff" />
      </g>
      <path d="M140 24l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#bdce2e" />
    </svg>
  );
}

// État vide « ventes » : ticket de caisse + pièces.
export function EmptyReceiptArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#fafbe7" />
      <ellipse cx="85" cy="120" rx="36" ry="5" fill="#0f172a" fillOpacity="0.1" />
      <path d="M58 18h54v94l-9-6-9 6-9-6-9 6-9-6-9 6Z" fill="#fff" stroke="#e5ee8f" strokeWidth="2" />
      <path d="M68 38h34M68 50h26M68 62h30" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <path d="M68 84h34" stroke="#636b16" strokeWidth="5" strokeLinecap="round" />
      <circle cx="124" cy="92" r="13" fill="#fbbf24" />
      <circle cx="124" cy="92" r="8" fill="#f59e0b" />
      <circle cx="40" cy="80" r="9" fill="#bdce2e" />
      <path d="M36 28l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#156fbe" />
    </svg>
  );
}

// État vide « annonces » : étiquette de prix.
export function EmptyTagArt({ className = '' }) {
  return (
    <svg width="170" height="130" viewBox="0 0 170 130" fill="none" aria-hidden="true" className={className}>
      <circle cx="85" cy="66" r="60" fill="#fafbe7" />
      <ellipse cx="85" cy="120" rx="36" ry="5" fill="#0f172a" fillOpacity="0.1" />
      <g transform="rotate(-18 85 66)">
        <path d="M52 40h50l22 26-22 26H52a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6Z" fill="#bdce2e" />
        <circle cx="104" cy="66" r="6" fill="#fafbe7" />
        <path d="M60 58h28M60 72h20" stroke="#24270a" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M110 22c8 0 12 6 10 14" stroke="#24270a" strokeWidth="3" strokeLinecap="round" />
      <path d="M138 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#156fbe" />
      <path d="M32 84l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#f97316" />
    </svg>
  );
}

const CONFETTI = [
  { type: 'rect', x: 30, y: 40, fill: '#bdce2e' },
  { type: 'rect', x: 206, y: 58, fill: '#f97316' },
  { type: 'rect', x: 48, y: 150, fill: '#156fbe' },
  { type: 'rect', x: 200, y: 150, fill: '#34bfcc' },
  { type: 'dot', x: 70, y: 22, fill: '#f97316' },
  { type: 'dot', x: 186, y: 24, fill: '#156fbe' },
  { type: 'dot', x: 226, y: 110, fill: '#bdce2e' },
  { type: 'dot', x: 22, y: 104, fill: '#453d80' },
];

// Écran de succès : carton qui flotte, coche qui apparaît, confettis.
export function SuccessArt({ className = '' }) {
  return (
    <svg width="250" height="210" viewBox="0 0 250 210" fill="none" aria-hidden="true" className={className}>
      <circle cx="125" cy="108" r="86" fill="#dceefc" />
      <circle cx="125" cy="108" r="62" fill="#b7ddfa" fillOpacity="0.45" />
      {CONFETTI.map((c, i) =>
        c.type === 'rect' ? (
          <rect key={i} x={c.x} y={c.y} width="10" height="5" rx="2" fill={c.fill} className="svg-origin animate-confetti" style={{ animationDelay: `${i * 0.15}s` }} />
        ) : (
          <circle key={i} cx={c.x} cy={c.y} r="4" fill={c.fill} className="svg-origin animate-confetti" style={{ animationDelay: `${i * 0.15}s` }} />
        )
      )}
      <g className="animate-float">
        <ellipse cx="125" cy="182" rx="50" ry="7" fill="#0f172a" fillOpacity="0.12" />
        <g transform="translate(73 72)">
          <path d="M52 0 104 22 52 44 0 22Z" fill={KRAFT.top} />
          <path d="M0 22 52 44v60L0 82Z" fill={KRAFT.left} />
          <path d="M104 22 52 44v60l52-22Z" fill={KRAFT.right} />
          <path d="M26 11 78 33v14" stroke="#fff" strokeOpacity="0.75" strokeWidth="7" />
        </g>
      </g>
      <g className="svg-origin animate-pop" style={{ animationDelay: '0.2s' }}>
        <circle cx="182" cy="74" r="24" fill="#bdce2e" stroke="#fff" strokeWidth="5" />
        <path d="m171 74 8 8 14-15" stroke="#24270a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function GlobeArt({ className = '' }) {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" className={className}>
      <circle cx="40" cy="40" r="30" fill="#d3f5f8" />
      <circle cx="40" cy="40" r="30" stroke="#10808d" strokeWidth="2" />
      <ellipse cx="40" cy="40" rx="13" ry="30" stroke="#10808d" strokeWidth="2" />
      <path d="M10 40h60M15 25h50M15 55h50" stroke="#10808d" strokeWidth="2" />
      <path d="M6 66C24 50 50 26 74 12" stroke="#bdce2e" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
    </svg>
  );
}

// Point "en direct" qui pulse (statuts en transit).
export function LiveDot({ className = 'bg-primary-600' }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      <span className={`absolute inset-0 animate-pulse-ring rounded-full ${className}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${className}`} />
    </span>
  );
}
