import { BoxArt } from '../illustrations';

// Chargement « vivant » du kit visuel : carton qui flotte + points animés.
export default function LoadingSpinner({ label = 'Chargement...', className = '' }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-10 text-surface-500 ${className}`}>
      <BoxArt size={56} className="animate-float" />
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full motion-safe:animate-bounce bg-primary-500" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <p className="text-sm">{label}</p>
    </div>
  );
}
