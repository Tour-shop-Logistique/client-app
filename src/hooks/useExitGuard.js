import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { closeTopSheet } from '../utils/sheetStack';

// Garde de sortie pour les parcours en plusieurs étapes (envoi d'un colis).
//
// L'app utilise <BrowserRouter> (pas de `useBlocker`) : on pose donc une entrée
// « sentinelle » dans l'historique, à la même URL. Le bouton retour du téléphone
// ou du navigateur nous ramène alors sur l'entrée d'origine sans quitter la page :
// on remet la sentinelle et on appelle `onBack` (fermer une feuille, revenir à
// l'étape précédente, ou demander confirmation avant de quitter).
// Les liens internes (barre de navigation, etc.) touchés pendant le parcours
// ouvrent aussi la confirmation au lieu de partir directement.
//
// - `active` : une saisie est en cours (sinon la navigation reste normale).
// - `onBack` : appelé à chaque retour (bouton système ou flèche de l'en-tête).
// - `fallback` : où aller si la page a été ouverte directement (pas d'historique).
const isSentinel = () => Boolean(window.history.state?.exitGuard);
const pushSentinel = () => window.history.pushState({ ...window.history.state, exitGuard: true }, '');

export default function useExitGuard({ active, onBack, fallback = '/' }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null); // null | { target: string | null }
  const pushed = useRef(false);
  const leaving = useRef(false);
  const onBackRef = useRef(onBack);
  const activeRef = useRef(active);

  useEffect(() => {
    onBackRef.current = onBack;
    activeRef.current = active;
  });

  // Pose la sentinelle dès qu'une saisie existe.
  useEffect(() => {
    if (!active || leaving.current) return;
    if (!isSentinel()) pushSentinel();
    pushed.current = true;
  }, [active]);

  // Bouton retour système / navigateur.
  useEffect(() => {
    const onPop = () => {
      if (leaving.current || !pushed.current || isSentinel()) return;
      // On vient de quitter la sentinelle : on est sur l'entrée d'origine.
      if (!activeRef.current) {
        // Plus rien à protéger (saisie effacée, envoi terminé) : on part.
        pushed.current = false;
        window.history.back();
        return;
      }
      pushSentinel();
      // Une feuille est ouverte (format, commune, confirmation...) : on la ferme.
      if (closeTopSheet()) return;
      onBackRef.current?.();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Liens internes touchés pendant la saisie (barre du bas, raccourcis...).
  useEffect(() => {
    if (!active) return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setConfirm({ target: `${url.pathname}${url.search}${url.hash}` });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  // Quitte réellement la page (après confirmation, ou sans saisie).
  const leave = useCallback(() => {
    const target = confirm?.target;
    leaving.current = true;
    setConfirm(null);
    if (target) {
      navigate(target);
      return;
    }
    // `idx` est l'index React Router de l'entrée (recopié dans la sentinelle).
    const idx = window.history.state?.idx ?? 0;
    if (idx > 0) window.history.go(isSentinel() ? -2 : -1);
    else navigate(fallback, { replace: true });
  }, [confirm, navigate, fallback]);

  const requestExit = useCallback(() => setConfirm({ target: null }), []);
  const stay = useCallback(() => setConfirm(null), []);

  return { confirmOpen: Boolean(confirm), requestExit, stay, leave };
}
