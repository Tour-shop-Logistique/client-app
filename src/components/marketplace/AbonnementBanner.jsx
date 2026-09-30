import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { AlertTriangle, Lock, ChevronRight, BellRing } from 'lucide-react';
import { ROUTES } from '../../routes';
import { formatDate } from '../../utils/format';
import { formatMoney } from '../../utils/marketplace';

// Bandeau d'abonnement (section 9.5) : visible si l'echeance courante est en
// rappel/retard, ou si l'utilisateur est bloque. Rien sinon.
export default function AbonnementBanner({ className = '' }) {
  const { bloque, echeanceCourante } = useSelector((s) => s.marketplace.abonnement);
  const statut = echeanceCourante?.statut;
  if (!bloque && statut !== 'rappel_envoye' && statut !== 'en_retard') return null;

  const blocking = bloque || statut === 'en_retard';
  const Icon = bloque ? Lock : blocking ? AlertTriangle : BellRing;
  const title = bloque
    ? 'Espace vendeur suspendu'
    : blocking
      ? 'Abonnement en retard'
      : 'Votre abonnement arrive à échéance';
  const text = echeanceCourante
    ? `${formatMoney(echeanceCourante.montant)} · échéance le ${formatDate(echeanceCourante.periode_fin)}`
    : 'Régularisez votre abonnement pour continuer à vendre.';

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={className}>
      <Link
        to={ROUTES.MARKETPLACE_SUBSCRIPTION}
        className={`flex items-center gap-3 rounded-2xl p-3.5 ${
          blocking ? 'bg-red-600 text-white' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${blocking ? 'bg-white/20' : 'bg-amber-100'}`}>
          <Icon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">{title}</span>
          <span className={`block text-caption ${blocking ? 'text-white/85' : 'text-amber-800'}`}>{text}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 opacity-70" />
      </Link>
    </motion.div>
  );
}
