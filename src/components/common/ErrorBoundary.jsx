import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// Évite l'écran blanc : affiche un écran de secours avec « Réessayer » / « Accueil ».
// `resetKey` (ex. le chemin) réinitialise l'erreur quand on change de page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Après une mise à jour de l'app, d'anciens fichiers de page n'existent plus.
    const outdated = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error?.message || '');
    return (
      <div className="page-container flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center" role="alert">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle size={24} />
        </span>
        <h1 className="font-heading text-lg font-semibold text-surface-900">
          {outdated ? 'Nouvelle version disponible' : 'Une erreur est survenue'}
        </h1>
        <p className="max-w-xs text-sm text-surface-500">
          {outdated
            ? 'Rechargez la page pour utiliser la dernière version de TourShop.'
            : 'Cet écran a rencontré un problème. Vos saisies en cours sont conservées en brouillon.'}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary h-11 px-5" onClick={() => (outdated ? window.location.reload() : this.setState({ error: null }))}>
            {outdated ? 'Recharger' : 'Réessayer'}
          </button>
          {!outdated && (
            <button type="button" className="btn-secondary h-11 px-5" onClick={() => window.location.assign('/')}>
              Accueil
            </button>
          )}
        </div>
      </div>
    );
  }
}
