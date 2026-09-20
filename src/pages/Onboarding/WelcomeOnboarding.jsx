import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import logo from '../../assets/logo_transparent.png';
import { markOnboardingSeen } from '../../utils/onboarding';

/* Illustrations: inline SVG so they work offline (PWA), stay sharp at any size
   and reuse the brand palette (navy / blue / teal / lime). */

function Box({ x, y, s = 1, tone = '#f2f6c4', dark = '#808c17' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 14 L28 0 L56 14 L56 46 L28 60 L0 46 Z" fill={tone} />
      <path d="M28 0 L56 14 L28 28 L0 14 Z" fill="#ffffff" opacity="0.55" />
      <path d="M28 28 L28 60" stroke={dark} strokeWidth="2" opacity="0.5" />
      <path d="M14 7 L42 21" stroke={dark} strokeWidth="5" opacity="0.35" />
    </g>
  );
}

function ShipIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" role="img" aria-label="Colis en route entre deux villes">
      <defs>
        <linearGradient id="ob-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2650" />
          <stop offset="0.55" stopColor="#10589a" />
          <stop offset="1" stopColor="#159faf" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="28" fill="url(#ob-sky)" />
      <circle cx="262" cy="52" r="26" fill="#ffffff" opacity="0.12" />
      <circle cx="262" cy="52" r="14" fill="#bdce2e" opacity="0.9" />
      {/* skyline */}
      <g fill="#ffffff" opacity="0.14">
        <rect x="18" y="120" width="26" height="70" rx="3" />
        <rect x="48" y="98" width="22" height="92" rx="3" />
        <rect x="74" y="132" width="28" height="58" rx="3" />
        <rect x="222" y="112" width="24" height="78" rx="3" />
        <rect x="250" y="130" width="30" height="60" rx="3" />
        <rect x="284" y="104" width="22" height="86" rx="3" />
      </g>
      {/* route */}
      <path d="M40 176 C 110 96, 210 96, 280 176" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="40" cy="176" r="8" fill="#ffffff" />
      <circle cx="40" cy="176" r="3.5" fill="#156fbe" />
      <circle cx="280" cy="176" r="8" fill="#bdce2e" />
      <circle cx="280" cy="176" r="3.5" fill="#45491b" />
      {/* parcel on the route */}
      <Box x={132} y={72} s={0.95} tone="#f2f6c4" />
      {/* ground */}
      <rect y="190" width="320" height="50" fill="#0c2540" opacity="0.35" />
      {/* tracking card */}
      <g transform="translate(70 196)">
        <rect width="180" height="30" rx="15" fill="#ffffff" />
        <circle cx="16" cy="15" r="6" fill="#159faf" />
        <rect x="30" y="9" width="70" height="5" rx="2.5" fill="#cbd5e1" />
        <rect x="30" y="18" width="46" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="128" y="8" width="42" height="14" rx="7" fill="#dceefc" />
        <rect x="136" y="13" width="26" height="4" rx="2" fill="#156fbe" />
      </g>
    </svg>
  );
}

function ShopIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" role="img" aria-label="Boutique en ligne avec produits">
      <defs>
        <linearGradient id="ob-shop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e5ee8f" />
          <stop offset="0.6" stopColor="#bdce2e" />
          <stop offset="1" stopColor="#a3b01e" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="28" fill="url(#ob-shop)" />
      <circle cx="40" cy="44" r="46" fill="#ffffff" opacity="0.18" />
      <circle cx="290" cy="210" r="60" fill="#ffffff" opacity="0.14" />
      {/* phone */}
      <g transform="translate(96 22)">
        <rect width="128" height="200" rx="20" fill="#24270a" />
        <rect x="6" y="6" width="116" height="188" rx="15" fill="#ffffff" />
        <rect x="16" y="18" width="70" height="8" rx="4" fill="#e2e8f0" />
        <circle cx="106" cy="22" r="6" fill="#156fbe" />
        {/* chips */}
        <rect x="16" y="36" width="34" height="14" rx="7" fill="#f2f6c4" />
        <rect x="54" y="36" width="34" height="14" rx="7" fill="#eff7fe" />
        {/* product cards */}
        <g>
          <rect x="16" y="60" width="47" height="60" rx="10" fill="#f8fafc" />
          <rect x="21" y="65" width="37" height="34" rx="7" fill="#dceefc" />
          <rect x="21" y="104" width="24" height="5" rx="2.5" fill="#94a3b8" />
          <rect x="21" y="112" width="16" height="4" rx="2" fill="#808c17" />
          <rect x="67" y="60" width="47" height="60" rx="10" fill="#f8fafc" />
          <rect x="72" y="65" width="37" height="34" rx="7" fill="#d3f5f8" />
          <rect x="72" y="104" width="24" height="5" rx="2.5" fill="#94a3b8" />
          <rect x="72" y="112" width="16" height="4" rx="2" fill="#808c17" />
          <rect x="16" y="126" width="47" height="60" rx="10" fill="#f8fafc" />
          <rect x="21" y="131" width="37" height="34" rx="7" fill="#f2f6c4" />
          <rect x="21" y="170" width="24" height="5" rx="2.5" fill="#94a3b8" />
          <rect x="67" y="126" width="47" height="60" rx="10" fill="#f8fafc" />
          <rect x="72" y="131" width="37" height="34" rx="7" fill="#dfdeee" />
          <rect x="72" y="170" width="24" height="5" rx="2.5" fill="#94a3b8" />
        </g>
      </g>
      {/* floating price tag + cart */}
      <g transform="translate(30 92)">
        <rect width="78" height="34" rx="17" fill="#ffffff" />
        <circle cx="17" cy="17" r="8" fill="#a3b01e" />
        <rect x="32" y="12" width="38" height="5" rx="2.5" fill="#45491b" />
        <rect x="32" y="21" width="24" height="4" rx="2" fill="#cbd5e1" />
      </g>
      <g transform="translate(226 138)">
        <rect width="64" height="64" rx="20" fill="#156fbe" />
        <path d="M18 22 h6 l4 18 h18 l4 -13 H27" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="31" cy="47" r="2.8" fill="#fff" />
        <circle cx="44" cy="47" r="2.8" fill="#fff" />
      </g>
      <Box x={38} y={150} s={0.8} tone="#ffffff" dark="#636b16" />
    </svg>
  );
}

function DeliveryIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" role="img" aria-label="Commande livrée au point relais">
      <defs>
        <linearGradient id="ob-bridge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eff7fe" />
          <stop offset="1" stopColor="#a9eaf0" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="28" fill="url(#ob-bridge)" />
      {/* map grid */}
      <g stroke="#82c3f5" strokeOpacity="0.5" strokeWidth="1.5">
        <path d="M0 70 H320 M0 130 H320 M0 190 H320" />
        <path d="M60 0 V240 M130 0 V240 M200 0 V240 M270 0 V240" />
      </g>
      <path d="M-10 200 C 70 150, 120 170, 170 120 S 270 70, 330 50" fill="none" stroke="#156fbe" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
      <path d="M-10 200 C 70 150, 120 170, 170 120 S 270 70, 330 50" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="1 10" strokeLinecap="round" />
      {/* relay pin */}
      <g transform="translate(214 46)">
        <path d="M32 0 C14 0 0 14 0 32 C0 56 32 84 32 84 C32 84 64 56 64 32 C64 14 50 0 32 0 Z" fill="#453d80" />
        <circle cx="32" cy="32" r="20" fill="#ffffff" />
        <path d="M20 34 L32 22 L44 34 V46 H20 Z" fill="#159faf" />
        <rect x="28" y="37" width="8" height="9" rx="1.5" fill="#ffffff" />
      </g>
      <ellipse cx="246" cy="136" rx="22" ry="5" fill="#0c2540" opacity="0.18" />
      {/* courier */}
      <g transform="translate(58 128)">
        <rect x="6" y="20" width="62" height="34" rx="9" fill="#156fbe" />
        <rect x="44" y="6" width="26" height="24" rx="6" fill="#2185d6" />
        <rect x="50" y="11" width="14" height="10" rx="2" fill="#dceefc" />
        <circle cx="22" cy="58" r="10" fill="#16132a" />
        <circle cx="22" cy="58" r="4" fill="#cbd5e1" />
        <circle cx="56" cy="58" r="10" fill="#16132a" />
        <circle cx="56" cy="58" r="4" fill="#cbd5e1" />
        <rect x="14" y="28" width="22" height="7" rx="3.5" fill="#bdce2e" />
      </g>
      {/* delivered badge */}
      <g transform="translate(34 30)">
        <rect width="118" height="36" rx="18" fill="#ffffff" />
        <circle cx="18" cy="18" r="10" fill="#bdce2e" />
        <path d="M13 18 l4 4 l7 -8" fill="none" stroke="#24270a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="36" y="11" width="60" height="6" rx="3" fill="#45491b" opacity="0.8" />
        <rect x="36" y="21" width="42" height="5" rx="2.5" fill="#cbd5e1" />
      </g>
    </svg>
  );
}

const SLIDES = [
  {
    art: ShipIllustration,
    kicker: 'Expédition',
    kickerColor: 'bg-primary-50 text-primary-700',
    title: 'Envoyez vos colis, partout',
    desc: "D'une ville à l'autre ou à l'international : déposez en agence ou faites enlever chez vous, et suivez chaque étape jusqu'à l'arrivée.",
  },
  {
    art: ShopIllustration,
    kicker: 'E-commerce',
    kickerColor: 'bg-shop-100 text-shop-800',
    title: 'Achetez et vendez en ligne',
    desc: 'Découvrez des articles, publiez vos propres annonces et gérez vos ventes. La livraison est assurée par TourShop.',
  },
  {
    art: DeliveryIllustration,
    kicker: 'Livraison',
    kickerColor: 'bg-teal-50 text-teal-700',
    title: 'De la commande à votre porte',
    desc: 'Chaque achat devient un colis suivi. Recevez-le à domicile ou récupérez-le dans une agence près de chez vous.',
  },
];

export default function WelcomeOnboarding({ onFinish }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef(null);
  const isLast = index === SLIDES.length - 1;

  const goTo = (i) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(i);
  };

  const finish = () => {
    markOnboardingSeen();
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-50">
      <div className="safe-top flex items-center justify-between px-5 pt-4">
        <img src={logo} alt="TourShop" className="h-8 w-auto" />
        {!isLast && (
          <button type="button" onClick={finish} className="text-body font-medium text-surface-500">
            Passer
          </button>
        )}
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="no-scrollbar mt-2 flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
      >
        {SLIDES.map((slide) => (
          <div
            key={slide.title}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6 text-center"
          >
            <div className="aspect-[4/3] w-full max-w-sm drop-shadow-xl">
              <slide.art />
            </div>
            <span className={`mt-7 rounded-full px-3 py-1 text-caption font-semibold ${slide.kickerColor}`}>
              {slide.kicker}
            </span>
            <h2 className="mt-3 text-display text-surface-900">{slide.title}</h2>
            <p className="mt-3 max-w-sm text-body text-surface-600">{slide.desc}</p>
          </div>
        ))}
      </div>

      <div className="safe-bottom px-6 pb-6 pt-2">
        <div className="mb-6 flex items-center justify-center gap-2">
          {SLIDES.map((slide, i) => (
            <span
              key={slide.title}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-primary-600' : 'w-1.5 bg-surface-200'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <button type="button" onClick={finish} className="btn-primary w-full">
            Commencer <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={() => goTo(index + 1)} className="btn-primary w-full">
            Suivant
          </button>
        )}
      </div>
    </div>
  );
}
