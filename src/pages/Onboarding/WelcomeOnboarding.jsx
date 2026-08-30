import { useRef, useState } from 'react';
import { PackagePlus, Store, MapPinned } from 'lucide-react';
import logo from '../../assets/logo_transparent.png';
import { markOnboardingSeen } from '../../utils/onboarding';

const SLIDES = [
  {
    icon: PackagePlus,
    color: 'bg-primary-50 text-primary-600',
    title: 'Expédiez en toute simplicité',
    desc: "Envoyez vos colis d'une ville à l'autre ou à l'international, et suivez-les en temps réel jusqu'à leur arrivée.",
  },
  {
    icon: Store,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Achetez et vendez',
    desc: 'Parcourez le marketplace, publiez vos propres annonces et gérez vos ventes directement depuis l’application.',
  },
  {
    icon: MapPinned,
    color: 'bg-violet-50 text-violet-600',
    title: 'Une agence près de chez vous',
    desc: 'Retrouvez le point relais le plus proche pour déposer ou récupérer vos colis en toute confiance.',
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
        <img src={logo} alt="Tour Shop" className="h-8 w-auto" />
        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="text-sm font-medium text-surface-500"
          >
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
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            <span className={`inline-flex h-28 w-28 items-center justify-center rounded-full ${slide.color}`}>
              <slide.icon size={52} strokeWidth={1.5} />
            </span>
            <h2 className="mt-8 text-xl font-bold text-surface-900">{slide.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-surface-500">{slide.desc}</p>
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
            Commencer
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
