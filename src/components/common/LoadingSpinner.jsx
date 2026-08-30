import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label = 'Chargement...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-surface-500 ${className}`}>
      <Loader2 className="animate-spin" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
