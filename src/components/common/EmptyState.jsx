// `illustration` (élément SVG du kit, ex. <EmptyParcelArt />) remplace la
// pastille d'icône : un écran vide doit rester accueillant, jamais blanc.
// `float={false}` pour une illustration déjà animée (Lottie).
export default function EmptyState({ icon: Icon, illustration, float = true, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white px-6 py-10 text-center shadow-card">
      {illustration ? (
        <div className={float ? 'animate-float' : undefined}>{illustration}</div>
      ) : (
        Icon && (
          <div className="icon-tile h-14 w-14 bg-primary-50 text-primary-600">
            <Icon size={26} />
          </div>
        )
      )}
      <div>
        <p className="font-heading text-base font-semibold text-surface-900">{title}</p>
        {description && <p className="mt-1 text-sm text-surface-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
