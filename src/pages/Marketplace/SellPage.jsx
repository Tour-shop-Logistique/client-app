import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import useRequireAuth from '../../hooks/useRequireAuth';
import marketplaceService from '../../services/marketplaceService';
import { ROUTES } from '../../routes';

const schema = yup.object({
  titre: yup.string().required('Le titre est requis'),
  prix: yup.number().typeError('Prix invalide').positive('Le prix doit etre positif').required('Le prix est requis'),
  description: yup.string().max(500, '500 caracteres maximum'),
});

export default function SellPage() {
  const navigate = useNavigate();
  const { requireAuth } = useRequireAuth();
  const [photo, setPhoto] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = (values) => {
    requireAuth(async () => {
      try {
        const payload = new FormData();
        Object.entries(values).forEach(([key, value]) => payload.append(key, value));
        if (photo) payload.append('photo', photo);
        await marketplaceService.createProduct(payload);
        toast.success('Article publie sur la marketplace.');
        navigate(ROUTES.MARKETPLACE_MY_LISTINGS);
      } catch (err) {
        toast.error(err.response?.data?.message || "Impossible de publier l'article.");
      }
    }, 'marketplace_order');
  };

  return (
    <div>
      <TopBar title="Vendre un article" back />
      <form onSubmit={handleSubmit(onSubmit)} className="page-container space-y-4 py-4">
        <label className="card flex items-center gap-3 p-4 text-sm text-surface-600">
          <Camera size={20} className="text-primary-600" />
          <span className="flex-1">{photo ? photo.name : 'Ajouter une photo'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </label>

        <label className="block text-sm font-medium text-surface-700">
          Titre
          <input className="input-field mt-1.5" placeholder="Ex: Chaussures Nike taille 42" {...register('titre')} />
          {errors.titre && <p className="mt-1 text-xs text-red-600">{errors.titre.message}</p>}
        </label>

        <label className="block text-sm font-medium text-surface-700">
          Prix (FCFA)
          <input type="number" className="input-field mt-1.5" placeholder="Ex: 15000" {...register('prix')} />
          {errors.prix && <p className="mt-1 text-xs text-red-600">{errors.prix.message}</p>}
        </label>

        <label className="block text-sm font-medium text-surface-700">
          Description
          <textarea rows={4} className="input-field mt-1.5" placeholder="Etat, taille, details..." {...register('description')} />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
        </label>

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Publication...' : "Publier l'article"}
        </button>
      </form>
    </div>
  );
}
