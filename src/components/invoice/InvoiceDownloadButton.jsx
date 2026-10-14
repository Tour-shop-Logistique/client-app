import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ReceiptA4 from './ReceiptA4';
import { domNodeToPdfBlob } from '../../utils/domToPdf';
import expeditionService from '../../services/expeditionService';

// Attend que les logos de la facture soient chargés : html2canvas capture
// sinon des cadres vides.
const waitForImages = (node) => Promise.all(
  Array.from(node.querySelectorAll('img')).map((img) => (
    img.complete ? null : new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    })
  )),
);

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Libéré après coup : une révocation immédiate peut annuler le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// Facture A4 générée sur le téléphone, identique à celle de l'agence. Passer
// `expedition` quand le détail complet est déjà chargé (colis, agence,
// expéditeur…) ; sinon seul `expeditionId` suffit et le détail est récupéré
// au clic — la réponse d'enregistrement ne contient pas tout.
export default function InvoiceDownloadButton({
  expeditionId,
  expedition,
  className = 'btn-secondary w-full',
  label = 'Télécharger la facture',
}) {
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null);
  const nodeRef = useRef(null);

  // La facture n'est montée (hors écran) que le temps de la capture.
  useEffect(() => {
    if (!target) return undefined;
    let alive = true;
    (async () => {
      try {
        await waitForImages(nodeRef.current);
        const blob = await domNodeToPdfBlob(nodeRef.current);
        if (!alive) return;
        const ref = String(target.reference || target.id).replace(/[^\w-]+/g, '-');
        saveBlob(blob, `Facture-${ref}.pdf`);
        toast.success('Facture téléchargée.');
      } catch {
        if (alive) toast.error('Impossible de générer la facture pour le moment.');
      } finally {
        if (alive) {
          setTarget(null);
          setBusy(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [target]);

  const handleClick = async () => {
    setBusy(true);
    try {
      const full = expedition ?? await expeditionService
        .clientShow(expeditionId)
        .then((res) => res.data ?? res);
      setTarget(full);
    } catch {
      toast.error('Impossible de charger la facture pour le moment.');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={handleClick} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        {busy ? 'Génération…' : label}
      </button>
      {target && createPortal(
        <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: '-10000px', pointerEvents: 'none' }}>
          <ReceiptA4 ref={nodeRef} expedition={target} agency={target.agence} />
        </div>,
        document.body,
      )}
    </>
  );
}
