import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Home, Building2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StepProgress from '../../components/expedition/StepProgress';
import useRequireAuth from '../../hooks/useRequireAuth';
import expeditionService from '../../services/expeditionService';
import { estimateIntervillePlaceholder } from '../../utils/estimate';
import { formatPrice } from '../../utils/format';
import { trackingPath } from '../../routes';

const SIZES = [
  { value: 'S', label: 'Petit', hint: '< 2kg, type document/accessoire' },
  { value: 'M', label: 'Moyen', hint: '2-8kg, type carton standard' },
  { value: 'L', label: 'Grand', hint: '8-20kg, type electromenager' },
  { value: 'XL', label: 'Tres grand', hint: '> 20kg, meuble/volumineux' },
];

const STEP_LABELS = ['Colis', 'Enlevement', 'Recapitulatif'];

export default function IntervilleFormPage() {
  const navigate = useNavigate();
  const { requireAuth } = useRequireAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [photo, setPhoto] = useState(null);

  const [form, setForm] = useState({
    villeDepart: '',
    villeDestination: '',
    poids: '',
    taille: 'M',
    description: '',
    agenceDepart: '',
    modeEnlevement: 'agence', // 'agence' | 'domicile'
    adresseEnlevement: '',
    dateEnlevement: '',
    paiement: 'mobile_money',
  });

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    if (!form.villeDestination || !form.poids) {
      setEstimate(null);
      return;
    }
    const villeDepart = form.villeDepart;
    const villeDestination = form.villeDestination;
    const poids = form.poids;
    const taille = form.taille;
    const timer = setTimeout(async () => {
      try {
        const data = await expeditionService.estimateInterville({ villeDepart, villeDestination, poids, taille });
        setEstimate(data);
      } catch {
        // Backend tarification not reachable yet in local dev — show a
        // placeholder estimate so the flow stays testable end-to-end.
        setEstimate(estimateIntervillePlaceholder({ poids, taille }));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [form.villeDepart, form.villeDestination, form.poids, form.taille]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(file);
  };

  const canContinueStep1 = form.villeDepart && form.villeDestination && form.poids;
  const canContinueStep2 =
    form.agenceDepart && (form.modeEnlevement === 'agence' || form.adresseEnlevement);

  const handleSubmit = () => {
    requireAuth(async () => {
      setSubmitting(true);
      try {
        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value));
        if (photo) payload.append('photo', photo);

        const result = await expeditionService.createInterville(payload);
        toast.success('Expedition enregistree !');
        navigate(trackingPath(result.id ?? result.data?.id ?? 'nouvelle'));
      } catch (err) {
        toast.error(err.response?.data?.message || "Impossible d'enregistrer l'expedition pour le moment.");
      } finally {
        setSubmitting(false);
      }
    }, 'expedition');
  };

  return (
    <div>
      <TopBar title="Expedition Interville" back />
      <div className="page-container py-4">
        <StepProgress step={step} total={3} labels={STEP_LABELS} />

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-surface-700">
              Ville de depart
              <input
                className="input-field mt-1.5"
                placeholder="Ex: Abidjan"
                value={form.villeDepart}
                onChange={update('villeDepart')}
              />
            </label>
            <label className="block text-sm font-medium text-surface-700">
              Ville de destination
              <input
                className="input-field mt-1.5"
                placeholder="Ex: Yamoussoukro"
                value={form.villeDestination}
                onChange={update('villeDestination')}
              />
            </label>
            <label className="block text-sm font-medium text-surface-700">
              Poids estime (kg)
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="input-field mt-1.5"
                placeholder="Ex: 3"
                value={form.poids}
                onChange={update('poids')}
              />
            </label>

            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Taille du colis</p>
              <div className="grid grid-cols-2 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, taille: s.value }))}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      form.taille === s.value
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-surface-200 text-surface-600'
                    }`}
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="text-xs text-surface-500">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium text-surface-700">
              Description du colis
              <textarea
                className="input-field mt-1.5"
                rows={2}
                placeholder="Ex: Vetements dans un carton"
                value={form.description}
                onChange={update('description')}
              />
            </label>

            <label className="card flex items-center gap-3 p-4 text-sm text-surface-600">
              <Camera size={20} className="text-primary-600" />
              <span className="flex-1">{photo ? photo.name : 'Ajouter une photo du colis'}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>

            {estimate && (
              <div className="card border border-primary-100 bg-primary-50/60 p-4">
                <p className="text-xs text-primary-700">Estimation du cout</p>
                <p className="text-xl font-bold text-primary-800">{formatPrice(estimate.montant)}</p>
              </div>
            )}

            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canContinueStep1}
              onClick={() => setStep(2)}
            >
              Continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-surface-700">
              Agence de depart
              <input
                className="input-field mt-1.5"
                placeholder="Choisir une agence a Abidjan"
                value={form.agenceDepart}
                onChange={update('agenceDepart')}
              />
            </label>

            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Mode de remise du colis</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, modeEnlevement: 'agence' }))}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm ${
                    form.modeEnlevement === 'agence'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-surface-200 text-surface-600'
                  }`}
                >
                  <Building2 size={18} />
                  Depot en agence
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, modeEnlevement: 'domicile' }))}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm ${
                    form.modeEnlevement === 'domicile'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-surface-200 text-surface-600'
                  }`}
                >
                  <Truck size={18} />
                  Enlevement a domicile
                </button>
              </div>
            </div>

            {form.modeEnlevement === 'domicile' && (
              <>
                <label className="block text-sm font-medium text-surface-700">
                  Adresse d'enlevement
                  <input
                    className="input-field mt-1.5"
                    placeholder="Quartier, rue, repere"
                    value={form.adresseEnlevement}
                    onChange={update('adresseEnlevement')}
                  />
                </label>
                <label className="block text-sm font-medium text-surface-700">
                  Date et heure souhaitees
                  <input
                    type="datetime-local"
                    className="input-field mt-1.5"
                    value={form.dateEnlevement}
                    onChange={update('dateEnlevement')}
                  />
                </label>
              </>
            )}

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>
                Retour
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={!canContinueStep2}
                onClick={() => setStep(3)}
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="card divide-y divide-surface-100 p-4 text-sm">
              <Row label="Trajet" value={`${form.villeDepart} → ${form.villeDestination}`} />
              <Row label="Colis" value={`${form.taille} · ${form.poids} kg`} />
              <Row label="Agence de depart" value={form.agenceDepart} />
              <Row
                label="Remise"
                value={form.modeEnlevement === 'domicile' ? `A domicile — ${form.adresseEnlevement}` : 'Depot en agence'}
              />
              {estimate && <Row label="Montant estime" value={formatPrice(estimate.montant)} strong />}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-surface-700">Paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'mobile_money', label: 'Mobile Money' },
                  { value: 'a_la_livraison', label: 'A la livraison' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, paiement: opt.value }))}
                    className={`rounded-xl border p-3 text-sm font-medium ${
                      form.paiement === opt.value
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-surface-200 text-surface-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-surface-400">
              <Home size={14} /> Une verification WhatsApp vous sera demandee pour confirmer.
            </p>

            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep(2)}>
                Retour
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Envoi...' : 'Confirmer l\'expedition'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-surface-500">{label}</span>
      <span className={strong ? 'font-semibold text-primary-700' : 'font-medium text-surface-900'}>{value}</span>
    </div>
  );
}
