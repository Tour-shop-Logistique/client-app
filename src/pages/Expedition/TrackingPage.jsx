import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Download, Star } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import expeditionService from '../../services/expeditionService';
import { formatDateTime, formatPrice } from '../../utils/format';

const STEPS = [
  { key: 'enregistre', label: 'Colis enregistre' },
  { key: 'depart_agence', label: 'Depart agence' },
  { key: 'en_transit', label: 'En transit' },
  { key: 'arrivee_agence', label: 'Arrivee agence' },
  { key: 'en_livraison', label: 'En livraison' },
  { key: 'livre', label: 'Livre' },
];

export default function TrackingPage() {
  const { id } = useParams();
  const [expedition, setExpedition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    let active = true;
    expeditionService
      .getById(id)
      .then((data) => active && setExpedition(data))
      .catch(() => active && setExpedition(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const currentIndex = STEPS.findIndex((s) => s.key === expedition?.statut);

  const handleConfirm = async () => {
    try {
      await expeditionService.confirmDelivery(id, code);
      toast.success('Livraison confirmee.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Code invalide.');
    }
  };

  const handleRate = async (note) => {
    setRating(note);
    try {
      await expeditionService.rate(id, { note });
      toast.success('Merci pour votre evaluation !');
    } catch {
      toast.error("Impossible d'enregistrer l'evaluation.");
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await expeditionService.downloadInvoice(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Facture indisponible pour le moment.");
    }
  };

  return (
    <div>
      <TopBar title={`Colis #${id}`} back />
      <div className="page-container py-4">
        {loading && <LoadingSpinner />}

        {!loading && !expedition && (
          <div className="card p-4 text-sm text-surface-500">
            Impossible de charger cette expedition. Verifiez votre connexion ou reessayez plus tard.
          </div>
        )}

        {!loading && expedition && (
          <div className="space-y-5">
            <div className="card p-4">
              <p className="text-sm text-surface-500">
                {expedition.ville_depart || expedition.pays_depart} → {expedition.ville_destination}
              </p>
              <p className="mt-1 text-lg font-bold text-surface-900">{formatPrice(expedition.montant)}</p>
            </div>

            <div className="card p-4">
              <p className="mb-3 text-sm font-semibold text-surface-900">Suivi du colis</p>
              <ol className="space-y-4">
                {STEPS.map((step, i) => {
                  const done = currentIndex >= 0 && i <= currentIndex;
                  return (
                    <li key={step.key} className="flex items-start gap-3">
                      {done ? (
                        <CheckCircle2 size={18} className="mt-0.5 text-primary-600" />
                      ) : (
                        <Circle size={18} className="mt-0.5 text-surface-300" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${done ? 'text-surface-900' : 'text-surface-400'}`}>
                          {step.label}
                        </p>
                        {expedition.historique?.[step.key] && (
                          <p className="text-xs text-surface-400">{formatDateTime(expedition.historique[step.key])}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {expedition.statut === 'en_livraison' && (
              <div className="card p-4">
                <p className="mb-2 text-sm font-semibold text-surface-900">Confirmer la reception</p>
                <p className="mb-3 text-xs text-surface-500">
                  Communiquez ce code au livreur uniquement au moment de la remise.
                </p>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder="Code de confirmation"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button type="button" className="btn-primary" onClick={handleConfirm}>
                    Valider
                  </button>
                </div>
              </div>
            )}

            {expedition.statut === 'livre' && (
              <div className="card p-4">
                <p className="mb-2 text-sm font-semibold text-surface-900">Evaluer le service</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => handleRate(n)} aria-label={`${n} etoiles`}>
                      <Star
                        size={26}
                        className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-surface-300'}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={handleDownload} className="btn-secondary w-full">
              <Download size={16} /> Telecharger la facture (PDF)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
