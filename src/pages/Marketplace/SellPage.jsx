import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Rocket, Save, Loader2, Info, Lightbulb, CheckCircle2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import { PhotoPicker } from '../../components/marketplace/FilePickers';
import { ProductImage } from '../../components/marketplace/ProductCard';
import AddressFields from '../../components/marketplace/AddressFields';
import useRequireAuth from '../../hooks/useRequireAuth';
import useMarketplaceError from '../../hooks/useMarketplaceError';
import marketplaceService from '../../services/marketplaceService';
import { formatMoney, personName, EMPTY_ADDRESS, toRetraitPayload } from '../../utils/marketplace';
import { ROUTES } from '../../routes';

// Contraintes de POST /marketplace/vendeur/annonces/store.
const schema = yup.object({
  titre: yup.string().trim().required('Le titre est requis').max(255, '255 caractères maximum'),
  prix: yup
    .number()
    .transform((v, o) => (o === '' ? undefined : v))
    .typeError('Prix invalide')
    .min(0, 'Le prix ne peut pas être négatif')
    .required('Le prix est requis'),
  description: yup.string().max(5000, '5000 caractères maximum'),
});

const TIPS = [
  'Des photos nettes, à la lumière du jour, vendent plus vite.',
  'Précisez l’état, la taille, la marque et les défauts éventuels.',
  'Un prix juste attire plus d’acheteurs : comparez avec les annonces similaires.',
];

export default function SellPage() {
  const navigate = useNavigate();
  const { requireAuth } = useRequireAuth();
  const handleError = useMarketplaceError();
  const abonnement = useSelector((s) => s.marketplace.abonnement);
  const user = useSelector((s) => s.auth.user);
  const [photos, setPhotos] = useState([]);
  // Adresse de retrait : indispensable au livreur pour recuperer l'article.
  const [retrait, setRetrait] = useState(() => ({
    ...EMPTY_ADDRESS,
    nom: user ? personName(user) : '',
    telephone: user?.telephone ?? '',
  }));
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(null); // 'draft' | 'publish'

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), defaultValues: { titre: '', prix: '', description: '' } });

  const titre = watch('titre');
  const prix = watch('prix');
  const description = watch('description') || '';
  const coverUrl = useMemo(() => (photos[0] ? URL.createObjectURL(photos[0]) : null), [photos]);
  useEffect(() => () => coverUrl && URL.revokeObjectURL(coverUrl), [coverUrl]);

  const completion = [photos.length > 0, Boolean(titre?.trim()), prix !== '' && prix != null, description.trim().length >= 20].filter(Boolean).length;

  const save = (publish) =>
    handleSubmit((values) =>
      requireAuth(async () => {
        setSubmitting(publish ? 'publish' : 'draft');
        let created = null;
        try {
          created = await marketplaceService.creerAnnonce({ ...values, photos, retrait: toRetraitPayload(retrait) });
          if (publish) {
            await marketplaceService.publierAnnonce(created.id);
            toast.success('Annonce publiée 🎉', { description: 'Elle est maintenant visible par les acheteurs.' });
          } else {
            toast.success('Brouillon enregistré', { description: 'Publiez-le quand vous êtes prêt.' });
          }
          navigate(ROUTES.MARKETPLACE_MY_LISTINGS, { replace: true });
        } catch (err) {
          const blocked = handleError(err, "Impossible d'enregistrer l'annonce.");
          // Creee mais pas publiee : ne pas laisser re-soumettre (doublon).
          if (created && !blocked) navigate(ROUTES.MARKETPLACE_MY_LISTINGS, { replace: true });
        } finally {
          setSubmitting(null);
        }
      }, 'marketplace')
    )();

  return (
    <div>
      <TopBar
        title="Nouvelle annonce"
        back
        right={
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-caption font-semibold text-surface-700"
          >
            {preview ? <EyeOff size={14} /> : <Eye size={14} />} Aperçu
          </button>
        }
      />

      <form onSubmit={(e) => e.preventDefault()} className="page-container space-y-5 py-4 pb-40">
        {/* Progression */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-caption">
            <span className="font-medium text-surface-600">Qualité de l’annonce</span>
            <span className="font-semibold text-shop-800">{completion}/4</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-shop-400 to-emerald-500"
              animate={{ width: `${(completion / 4) * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mb-2 text-caption font-medium text-surface-500">Voici comment les acheteurs verront votre annonce :</p>
              <div className="mx-auto w-1/2 overflow-hidden rounded-2xl bg-white shadow-lg">
                <ProductImage src={coverUrl} alt="" className="aspect-[4/5]" />
                <div className="space-y-0.5 p-3">
                  <p className="font-heading text-[15px] font-bold">{prix !== '' ? formatMoney(prix) : '— FCFA'}</p>
                  <p className="line-clamp-2 text-body text-surface-700">{titre || 'Titre de votre article'}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-body font-semibold text-surface-900">Photos</h2>
            <span className="text-caption text-surface-400">10 max · 5 Mo chacune</span>
          </div>
          <PhotoPicker files={photos} onChange={setPhotos} />
          <p className="mt-2 flex items-start gap-1.5 text-caption text-surface-500">
            <Info size={13} className="mt-0.5 shrink-0" /> Les photos s’ajoutent uniquement à la création de l’annonce.
          </p>
        </section>

        <label className="block">
          <span className="text-body font-semibold text-surface-900">Titre</span>
          <input className="input-field mt-1.5" placeholder="Ex : Canapé 3 places en tissu gris" maxLength={255} {...register('titre')} />
          {errors.titre && <p className="mt-1 text-caption text-red-600">{errors.titre.message}</p>}
        </label>

        <label className="block">
          <span className="text-body font-semibold text-surface-900">Prix</span>
          <div className="relative mt-1.5">
            <input type="number" inputMode="numeric" min="0" className="input-field pr-16 font-semibold" placeholder="15000" {...register('prix')} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption font-semibold text-surface-400">FCFA</span>
          </div>
          {errors.prix && <p className="mt-1 text-caption text-red-600">{errors.prix.message}</p>}
        </label>

        <label className="block">
          <span className="flex items-baseline justify-between">
            <span className="text-body font-semibold text-surface-900">Description</span>
            <span className={`text-caption ${description.length > 4800 ? 'text-red-600' : 'text-surface-400'}`}>{description.length}/5000</span>
          </span>
          <textarea rows={5} maxLength={5000} className="input-field mt-1.5" placeholder="État, dimensions, marque, défauts…" {...register('description')} />
          {errors.description && <p className="mt-1 text-caption text-red-600">{errors.description.message}</p>}
        </label>

        <section className="card space-y-3 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-body font-semibold text-surface-900">
              <MapPin size={16} className="text-shop-700" /> Adresse de retrait
            </h2>
            <p className="text-caption text-surface-500">
              Où le livreur récupère l’article. Facultatif, mais nécessaire pour une livraison par un livreur TourShop.
            </p>
          </div>
          <AddressFields value={retrait} onChange={setRetrait} idPrefix="retrait" />
        </section>

        <section className="rounded-2xl bg-shop-50 p-4 ring-1 ring-shop-100">
          <p className="mb-2 flex items-center gap-2 text-body font-semibold text-shop-900">
            <Lightbulb size={16} /> Conseils pour vendre vite
          </p>
          <ul className="space-y-1.5">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-2 text-caption text-shop-900">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-shop-600" /> {t}
              </li>
            ))}
          </ul>
        </section>

        {abonnement.loaded && !abonnement.abonnement && (
          <p className="flex gap-2 rounded-2xl bg-primary-50 p-3.5 text-caption text-primary-900">
            <Info size={15} className="mt-0.5 shrink-0" />
            La publication de votre première annonce active votre abonnement vendeur. La première échéance tombe environ 30 jours plus tard.
          </p>
        )}
      </form>

      <div className="fixed inset-x-0 bottom-[calc(theme(spacing.bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-20">
        <div className="mx-auto flex max-w-md gap-2 border-t border-surface-100 bg-white/95 px-4 py-3 backdrop-blur">
          <button type="button" className="btn-secondary flex-1" disabled={Boolean(submitting)} onClick={() => save(false)}>
            {submitting === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Brouillon
          </button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} className="btn-shop flex-[1.4]" disabled={Boolean(submitting)} onClick={() => save(true)}>
            {submitting === 'publish' ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Publier
          </motion.button>
        </div>
      </div>
    </div>
  );
}
