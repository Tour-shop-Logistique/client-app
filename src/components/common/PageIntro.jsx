// En-tête explicatif des écrans de formulaire : pastille d'icône teintée +
// titre + texte. `tone` reprend les familles de couleur du kit visuel.
const TONES = {
  primary: { box: 'bg-primary-50', tile: 'bg-primary-100 text-primary-600' },
  teal: { box: 'bg-teal-50', tile: 'bg-teal-100 text-teal-600' },
  shop: { box: 'bg-shop-50', tile: 'bg-shop-100 text-shop-700' },
  amber: { box: 'bg-amber-50', tile: 'bg-amber-100 text-amber-700' },
  danger: { box: 'bg-red-50', tile: 'bg-red-100 text-red-600' },
};

export default function PageIntro({ icon, title, text, tone = 'primary', children }) {
  const Icon = icon;
  const t = TONES[tone] || TONES.primary;
  return (
    <div className={`flex items-start gap-3.5 rounded-3xl p-4 ${t.box}`}>
      <span className={`icon-tile h-12 w-12 ${t.tile}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-[15px] font-semibold text-surface-900">{title}</p>
        {text && <p className="mt-0.5 text-body text-surface-600">{text}</p>}
        {children}
      </div>
    </div>
  );
}
