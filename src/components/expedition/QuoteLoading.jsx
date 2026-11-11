// Trois points animés + message : un calcul de tarif est en cours (utile en réseau faible).
export function LoadingDots({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-500 motion-safe:animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

export default function QuoteLoading({ label = 'Calcul du tarif en cours…' }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2.5 rounded-xl bg-primary-50 px-3 py-2.5 text-sm font-medium text-primary-700">
      <LoadingDots />
      <span>{label}</span>
    </div>
  );
}
