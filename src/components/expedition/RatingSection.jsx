import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import expeditionService from '../../services/expeditionService';
import { formatDate } from '../../utils/format';

// Évaluation du service en fin d'expédition (cahier 4.2 / 4.3). Une seule
// évaluation par expédition, non modifiable (REPONSE_AUDIT §4). Affichée
// seulement quand l'expédition est `termined`.
const LABELS = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];

function Stars({ value, onChange, readOnly = false }) {
  if (readOnly) {
    return (
      <div className="flex gap-1" aria-label={`${value} sur 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={20} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-surface-200'} aria-hidden="true" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Note sur 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sur 5, ${LABELS[n]}`}
          onClick={() => onChange(n)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-amber-50 active:scale-95"
        >
          <Star size={28} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-surface-300'} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default function RatingSection({ expeditionId }) {
  const [evaluation, setEvaluation] = useState(undefined); // undefined = chargement
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    expeditionService
      .getEvaluation(expeditionId)
      .then((res) => alive && setEvaluation(res?.data ?? null))
      .catch(() => alive && setEvaluation(null));
    return () => { alive = false; };
  }, [expeditionId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!note) return;
    setSending(true);
    try {
      const res = await expeditionService.rate(expeditionId, { note, commentaire: commentaire.trim() });
      setEvaluation(res?.data ?? { note, commentaire: commentaire.trim(), created_at: new Date().toISOString() });
      toast.success('Merci pour votre avis !');
    } catch (err) {
      // 422 : pas encore terminée, ou déjà évaluée — message du serveur tel quel.
      toast.error(err.response?.data?.message || "Impossible d'envoyer votre avis.");
    } finally {
      setSending(false);
    }
  };

  if (evaluation === undefined) return null;

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold text-surface-900">Votre avis</h2>
      {evaluation ? (
        <div className="mt-2 space-y-1.5">
          <Stars value={Number(evaluation.note)} readOnly />
          {evaluation.commentaire && <p className="text-sm text-surface-700">« {evaluation.commentaire} »</p>}
          {evaluation.created_at && <p className="text-xs text-surface-500">Envoyé le {formatDate(evaluation.created_at)}</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2 space-y-3">
          <p className="text-sm text-surface-500">Comment s'est passée cette expédition ?</p>
          <div>
            <Stars value={note} onChange={setNote} />
            <p className="mt-1 h-4 text-xs font-medium text-amber-700" aria-live="polite">{LABELS[note]}</p>
          </div>
          <label className="block text-sm font-medium text-surface-700">
            Commentaire <span className="font-normal text-surface-500">(facultatif)</span>
            <textarea
              rows={3}
              maxLength={1000}
              className="input-field mt-1.5"
              placeholder="Délais, état du colis, accueil en agence…"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={!note || sending}>
            {sending ? 'Envoi…' : 'Envoyer mon avis'}
          </button>
          <p className="text-center text-xs text-surface-500">Un seul avis par expédition, non modifiable ensuite.</p>
        </form>
      )}
    </section>
  );
}
