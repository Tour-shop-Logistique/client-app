import { lazy, Suspense } from 'react';
import { EmptyParcelArt } from './index';

// Version animée (Lottie) de EmptyParcelArt. lottie-web est lourd : chargé à
// la demande, l'illustration fixe s'affiche en attendant. Animation figée si
// l'utilisateur a demandé moins de mouvements.

const LottieParcel = lazy(async () => {
  const [{ default: Player }, { default: data }] = await Promise.all([
    import('lottie-react'), import('./emptyParcelLottie'),
  ]);
  return {
    default: function LottieParcelPlayer({ play }) {
      return <Player animationData={data} loop={play} autoplay={play} style={{ width: 170, height: 136 }} aria-hidden="true" />;
    },
  };
});

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function EmptyParcelAnimation() {
  return (
    <Suspense fallback={<EmptyParcelArt />}>
      <LottieParcel play={!reducedMotion()} />
    </Suspense>
  );
}
