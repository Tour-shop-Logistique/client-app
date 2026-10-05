import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, Loader2, Save, Rocket, EyeOff, Info, ExternalLink, PackageX, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import StatusBadge from '../../components/marketplace/StatusBadge';
import AddressFields from '../../components/marketplace/AddressFields';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import marketplaceService from '../../services/marketplaceService';
import {
  ANNONCE_STATUTS, annoncePhotos, handleMediaError, fromRetrait, toRetraitPayload, hasRetraitAddress,
} from '../../utils/marketplace';
import { ROUTES, productPath } from '../../routes';

export default function ListingEditPage() {
  const { id } = useParams();
  const handleError = useMarketplaceError();
  const [annonce, setAnnonce] = useState(undefined);
  const [form, setForm] = useState({ titre: '', prix: '', description: '' });
  const [retrait, setRetrait] = useState(() => fromRetrait(null));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(null);

  useEffect(() => {
    marketplaceService
      .annonceShow(id)
      .then((a) => {
        setAnnonce(a);
        setForm({ titre: a.titre ?? '', prix: String(a.prix ?? ''), description: a.description ?? '' });
        setRetrait(fromRetrait(a));
      })
      .catch((err) => {
        setAnnonce(null);
        if (err?.response?.status !== 404) handleError(err);
      });
  }, [id, handleError]);

  if (annonce === undefined) {
    return (
      <div>
        <TopBar title="Modifier l’annonce" back />
        <div className="page-container space-y-3 py-4">
          <div className="h-24 skeleton rounded-2xl shadow-card" />
          <div className="h-48 skeleton rounded-2xl shadow-card" />
        </div>
      </div>
    );
  }

  if (annonce === null) {
    return (
      <div>
        <TopBar title="Modifier l’annonce" back />
        <div className="page-container flex flex-col items-center gap-3 py-16 text-center">
          <PackageX size={36} className="text-surface-400" />
          <p className="text-title">Annonce introuvable</p>
          <Link to={ROUTES.MARKETPLACE_MY_LISTINGS} className="btn-secondary">
            Mes annonces
          </Link>
        </div>
      </div>
    );
  }

  const photos = annoncePhotos(annonce);
  const locked = annonce.statut === 'vendue';

  // PUT update : champs en `sometimes`, on n'envoie que ce qui a change.
  const changes = {};
  if (form.titre.trim() !== (annonce.titre ?? '')) changes.titre = form.titre.trim();
  if (form.description !== (annonce.description ?? '')) changes.description = form.description;
  if (form.prix !== '' && Number(form.prix) !== Number(annonce.prix)) changes.prix = Number(form.prix);
  // Adresse de retrait : champs `sometimes`, seulement ceux modifies.
  const retraitPayload = toRetraitPayload(retrait);
  Object.entries(retraitPayload).forEach(([key, v]) => {
    if (String(v) !== String(annonce[key] ?? '')) changes[key] = v;
  });
  const dirty = Object.keys(changes).length > 0;
  const invalid = !form.titre.trim() || form.prix === '' || Number(form.prix) < 0;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await marketplaceService.modifierAnnonce(annonce.id, changes);
      setAnnonce((a) => ({ ...a, ...updated }));
      toast.success('Annonce mise à jour');
    } catch (err) {
      handleError(err, 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    setToggling(true);
    try {
      const updated =
        annonce.statut === 'publiee'
          ? await marketplaceService.depublierAnnonce(annonce.id)
          : await marketplaceService.publierAnnonce(annonce.id);
      setAnnonce((a) => ({ ...a, ...updated }));
      toast.success(updated.statut === 'publiee' ? 'Annonce publiée' : 'Annonce retirée du catalogue');
    } catch (err) {
      handleError(err, 'Action impossible.');
    } finally {
      setToggling(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (!window.confirm('Supprimer cette photo ? Elle ne pourra pas être rajoutée.')) return;
    setDeletingPhoto(photo.id);
    try {
      await marketplaceService.supprimerPhoto(annonce.id, photo.id);
      setAnnonce((a) => ({ ...a, photos: a.photos.filter((p) => p.id !== photo.id) }));
      toast.success('Photo supprimée');
    } catch (err) {
      handleError(err, 'Suppression impossible.');
    } finally {
      setDeletingPhoto(null);
    }
  };

  return (
    <div>
      <TopBar
        title="Modifier l’annonce"
        back
        right={
          annonce.statut === 'publiee' && (
            <Link to={productPath(annonce.id)} className="rounded-full p-2 text-surface-500 hover:bg-surface-100" aria-label="Voir l'annonce">
              <ExternalLink size={18} />
            </Link>
          )
        }
      />
      <div className="page-container space-y-5 py-4 pb-40">
        <div className="card flex items-center justify-between p-4">
          <div>
            <p className="text-caption text-surface-400">Statut</p>
            <StatusBadge map={ANNONCE_STATUTS} value={annonce.statut} className="mt-1" />
          </div>
          {!locked && annonce.statut !== 'masquee' && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={toggling}
              onClick={togglePublish}
              className={`btn py-2 ${annonce.statut === 'publiee' ? 'bg-amber-50 text-amber-800' : 'bg-shop-400 text-shop-950'}`}
            >
              {toggling ? <Loader2 size={15} className="animate-spin" /> : annonce.statut === 'publiee' ? <EyeOff size={15} /> : <Rocket size={15} />}
              {annonce.statut === 'publiee' ? 'Retirer' : 'Publier'}
            </motion.button>
          )}
        </div>

        <section>
          <h2 className="mb-2 text-body font-semibold text-surface-900">Photos ({photos.length})</h2>
          {photos.length === 0 ? (
            <p className="rounded-xl bg-surface-100 p-4 text-caption text-surface-500">Aucune photo.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <AnimatePresence>
                {photos.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative aspect-square overflow-hidden rounded-xl bg-surface-100"
                  >
                    <img src={p.url} alt="" onError={handleMediaError} className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-full bg-shop-400 px-2 py-0.5 text-[11px] font-bold text-shop-950">Couverture</span>
                    )}
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => deletePhoto(p)}
                        disabled={deletingPhoto === p.id}
                        className="absolute right-1 top-1 rounded-full bg-black/55 p-1.5 text-white backdrop-blur"
                        aria-label="Supprimer la photo"
                      >
                        {deletingPhoto === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-caption text-surface-500">
            <Info size={13} className="mt-0.5 shrink-0" /> Il n’est pas possible d’ajouter des photos après la création.
          </p>
        </section>

        <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
          <label className="block">
            <span className="text-body font-semibold text-surface-900">Titre</span>
            <input className="input-field mt-1.5" maxLength={255} value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-body font-semibold text-surface-900">Prix</span>
            <div className="relative mt-1.5">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="input-field pr-16 font-semibold"
                value={form.prix}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption font-semibold text-surface-400">FCFA</span>
            </div>
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between">
              <span className="text-body font-semibold text-surface-900">Description</span>
              <span className="text-caption text-surface-400">{form.description.length}/5000</span>
            </span>
            <textarea
              rows={5}
              maxLength={5000}
              className="input-field mt-1.5"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          <section className="card space-y-3 p-4">
            <div>
              <h2 className="flex items-center gap-2 text-body font-semibold text-surface-900">
                <MapPin size={16} className="text-shop-700" /> Adresse de retrait
              </h2>
              <p className="text-caption text-surface-500">
                Copiée sur la commande quand vous choisissez une livraison par livreur.
              </p>
            </div>
            {!hasRetraitAddress(annonce) && (
              <p className="rounded-xl bg-amber-50 p-3 text-caption text-amber-800">
                Sans adresse de retrait, le livreur ne saura pas où récupérer l’article.
              </p>
            )}
            <AddressFields value={retrait} onChange={setRetrait} idPrefix="retrait" disabled={locked} />
          </section>
        </fieldset>
      </div>

      <AnimatePresence>
        {dirty && !locked && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-20"
          >
            <div className="mx-auto flex max-w-md gap-2 border-t border-surface-100 bg-white/95 px-4 py-3 backdrop-blur">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setForm({ titre: annonce.titre ?? '', prix: String(annonce.prix ?? ''), description: annonce.description ?? '' });
                  setRetrait(fromRetrait(annonce));
                }}
              >
                Annuler
              </button>
              <button type="button" className="btn-shop flex-[1.4]" disabled={saving || invalid} onClick={save}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
