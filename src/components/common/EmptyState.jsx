export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-surface-200 px-6 py-12 text-center">
      {Icon && (
        <div className="rounded-full bg-primary-50 p-3 text-primary-600">
          <Icon size={24} />
        </div>
      )}
      <div>
        <p className="font-semibold text-surface-900">{title}</p>
        {description && <p className="mt-1 text-sm text-surface-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
