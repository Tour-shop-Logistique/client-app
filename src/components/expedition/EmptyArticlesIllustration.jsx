import { useState } from 'react';
import colisAgenceImg from '../../assets/illustrations/colis-agence.jpg';
import EmptyParcelAnimation from '../illustrations/EmptyParcelAnimation';

// Photo d'accueil de l'état « aucun article ». Si l'image ne se charge pas
// (réseau, cache PWA, fichier absent), on retombe sur l'ancienne animation.
export default function EmptyArticlesIllustration() {
  const [failed, setFailed] = useState(false);

  if (failed) return <EmptyParcelAnimation />;

  return (
    <img
      src={colisAgenceImg}
      alt="Une agente TourShop Express tenant une caisse de produits à expédier"
      width={800}
      height={640}
      onError={() => setFailed(true)}
      onLoad={(e) => {
        // Chargée mais vide ou corrompue : même repli.
        if (!e.currentTarget.naturalWidth) setFailed(true);
      }}
      className="h-auto w-full max-w-sm rounded-2xl object-cover"
    />
  );
}
