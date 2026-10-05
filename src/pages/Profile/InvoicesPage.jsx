import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import { FileText, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import TopBar from '../../components/common/TopBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import PageIntro from '../../components/common/PageIntro';
import { EmptyParcelArt } from '../../components/illustrations';
import expeditionService from '../../services/expeditionService';
import { formatDate, formatPrice } from '../../utils/format';
import { ROUTES, expeditionDetailPath } from '../../routes';

// Factures du client (cahier 4.2 / 4.3, workflow 8.1 étape 9) : émises par
// l'agence, le client les consulte et les télécharge en PDF
// (REPONSE_AUDIT_CAHIER_DES_CHARGES_CLIENT.md §3).

// Champs d'une facture non détaillés par la doc : lecture défensive.
const invoiceNumber = (f) => f.numero_facture || f.numero || f.reference || `Facture ${String(f.id).slice(0, 8)}`;
const invoiceAmount = (f) => f.montant_ttc ?? f.montant_total ?? f.montant ?? f.total ?? null;
const invoiceDate = (f) => f.date_facture || f.date_emission || f.created_at;

export default function InvoicesPage() {
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(() => {
    setError(false);
    setInvoices(null);
    expeditionService
      .listInvoices()
      .then((res) => {
        const list = res?.data ?? res?.factures ?? [];
        setInvoices(Array.isArray(list) ? list : []);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  if (!isAuthenticated) return <Navigate to={ROUTES.PROFILE} replace />;

  const handleDownload = async (facture) => {
    setDownloading(facture.id);
    try {
      const blob = await expeditionService.downloadInvoice(facture.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber(facture).replace(/[^\w-]+/g, '-')}.pdf`;
      link.click();
      // Libéré après coup : une révocation immédiate peut annuler le téléchargement.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error('Téléchargement impossible pour le moment.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <TopBar title="Mes factures" back />
      <div className="page-container py-4">
        {invoices === null && !error && <LoadingSpinner />}

        {error && (
          <EmptyState
            icon={FileText}
            title="Chargement impossible"
            description="Vos factures n'ont pas pu être chargées."
            action={(
              <button type="button" className="btn-secondary mt-2" onClick={load}>
                <RefreshCw size={16} /> Réessayer
              </button>
            )}
          />
        )}

        {invoices?.length === 0 && (
          <EmptyState
            illustration={<EmptyParcelArt />}
            title="Aucune facture"
            description="Les factures émises par votre agence pour vos expéditions apparaîtront ici."
          />
        )}

        {invoices?.length > 0 && (
          <PageIntro
            icon={FileText}
            tone="teal"
            title={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}`}
            text="Émises par votre agence, téléchargeables en PDF."
          />
        )}

        {invoices?.length > 0 && (
          <ul className="mt-4 space-y-3">
            {invoices.map((f) => {
              const exp = f.expedition || {};
              const route = [exp.pays_depart, exp.pays_destination].filter(Boolean).join(' → ');
              const busy = downloading === f.id;
              return (
                <li key={f.id} className="card flex items-center gap-3 p-4">
                  <span className="icon-tile h-11 w-11 rounded-[14px] bg-teal-100 text-teal-600">
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-surface-900">{invoiceNumber(f)}</p>
                    <p className="truncate text-xs text-surface-500">
                      {[formatDate(invoiceDate(f)), invoiceAmount(f) != null && formatPrice(invoiceAmount(f))].filter(Boolean).join(' · ')}
                    </p>
                    {exp.reference && (exp.id ?? f.expedition_id) ? (
                      <Link to={expeditionDetailPath(exp.id ?? f.expedition_id)} className="block truncate text-xs font-medium text-primary-600">
                        {exp.reference}{route ? ` · ${route}` : ''}
                      </Link>
                    ) : exp.reference && (
                      <p className="truncate text-xs text-surface-500">{exp.reference}{route ? ` · ${route}` : ''}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(f)}
                    disabled={busy}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-600 text-white shadow-brand transition active:scale-90 disabled:opacity-60"
                    aria-label={`Télécharger ${invoiceNumber(f)} en PDF`}
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
