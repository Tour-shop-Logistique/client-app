import { useEffect, useState } from 'react';

// Champs qui ouvrent le clavier à l'écran (pas les cases, boutons, etc.).
const TEXT_FIELD = 'textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range])';

// true tant qu'un champ de saisie a le focus. Sert à replier la navigation du
// bas pendant la saisie (et à recaler ce qui se pose au-dessus d'elle).
export default function useTyping() {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let timer;
    const onIn = (e) => {
      if (e.target instanceof Element && e.target.matches(TEXT_FIELD)) {
        clearTimeout(timer);
        setTyping(true);
      }
    };
    // Petit délai : passer d'un champ à l'autre ne doit pas faire clignoter la barre.
    const onOut = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), 150);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  return typing;
}
