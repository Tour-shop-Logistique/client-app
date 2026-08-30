import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import expeditionService from '../../services/expeditionService';
import { formatDate, formatPrice } from '../../utils/format';

export default function InvoicesPage() {
  const [expeditions, setExpeditions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    expeditionService
      .list()
      .then((data) => setExpeditions(data.data ?? data))
      .catch(() => setExpeditions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id) => {
    try {
      const blob = await expeditionService.downloadInvoice(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Facture indisponible.');
    }
  };

  return (
    <div>
      <TopBar title="Mes factures" back />
      <div className="page-container py-4">
        {loading && <LoadingSpinner />}

        {!loading && expeditions.length === 0 && (
          <EmptyState icon={FileText} title="Aucune facture" description="Vos factures d'expedition apparaitront ici." />
        )}

        {!loading && expeditions.length > 0 && (
          <div className="space-y-3">
            {expeditions.map((exp) => (
              <div key={exp.id} className="card flex items-center gap-3 p-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-surface-500">
                  <FileText size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">
                    Expedition #{exp.id} — {formatDate(exp.created_at)}
                  </p>
                  <p className="text-xs text-surface-500">{formatPrice(exp.montant)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(exp.id)}
                  className="rounded-full bg-primary-50 p-2 text-primary-600"
                  aria-label="Telecharger"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
