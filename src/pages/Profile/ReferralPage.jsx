import { useEffect, useState } from 'react';
import { Share2, Copy, Gift } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import referralService from '../../services/referralService';
import { formatPrice } from '../../utils/format';

export default function ReferralPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    referralService
      .getMyReferral()
      .then(setData)
      .catch(() => setData({ code: null, bonus_total: 0, filleuls_count: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const shareText = data?.code
    ? `Rejoins TourShop avec mon code de parrainage ${data.code} et beneficie d'avantages sur tes expeditions !`
    : '';

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ text: shareText });
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success('Message copie, partagez-le sur WhatsApp !');
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(data.code);
    toast.success('Code copie.');
  };

  return (
    <div>
      <TopBar title="Parrainage" back />
      <div className="page-container py-4">
        {loading && <LoadingSpinner />}

        {!loading && data && (
          <div className="space-y-4">
            <div className="card bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white">
              <Gift size={22} />
              <p className="mt-3 text-sm text-amber-50">Votre code de parrainage</p>
              <p className="mt-1 text-2xl font-bold tracking-wide">{data.code || '—'}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={handleCopyCode} className="btn bg-white/20 text-white flex-1">
                  <Copy size={16} /> Copier
                </button>
                <button type="button" onClick={handleShare} className="btn bg-white text-amber-700 flex-1">
                  <Share2 size={16} /> Partager
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="text-xs text-surface-500">Filleuls actifs</p>
                <p className="mt-1 text-xl font-bold text-surface-900">{data.filleuls_count ?? 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-surface-500">Bonus cumules</p>
                <p className="mt-1 text-xl font-bold text-primary-700">{formatPrice(data.bonus_total ?? 0)}</p>
              </div>
            </div>

            <p className="text-xs text-surface-400">
              Un bonus vous est attribue a chaque expedition realisee par un filleul inscrit avec votre code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
