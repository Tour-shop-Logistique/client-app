import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { EmptyCartArt } from '../illustrations';
import { openAuthSheet } from '../../store/slices/uiSlice';

// Toutes les routes marketplace exigent un token Sanctum : un invite voit cet
// ecran a la place du contenu, avec ouverture de la feuille de connexion.
export default function GuestGate({
  title = 'Connectez-vous pour continuer',
  description = 'Accédez aux articles, à votre panier et à vos commandes.',
}) {
  const dispatch = useDispatch();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-10 text-center shadow-card"
    >
      <span className="animate-float">
        <EmptyCartArt />
      </span>
      <div>
        <p className="text-title text-surface-900">{title}</p>
        <p className="mt-1 text-body text-surface-500">{description}</p>
      </div>
      <button
        type="button"
        className="btn-shop w-full max-w-xs"
        onClick={() => dispatch(openAuthSheet({ mode: 'login', reason: 'marketplace' }))}
      >
        <LogIn size={16} /> Se connecter
      </button>
    </motion.div>
  );
}
