import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Bell, MapPinned } from 'lucide-react';
import TopBar from '../../components/common/TopBar';
import { BoxArt, GlobeArt } from '../../components/illustrations';
import { ROUTES } from '../../routes';

const CHOICES = [
  {
    to: ROUTES.EXPEDITION_INTERVILLE,
    title: 'Interville',
    text: "Entre deux villes d'un même pays",
    art: <BoxArt size={72} />,
    tint: 'bg-primary-50',
    ring: 'ring-primary-100',
  },
  {
    to: ROUTES.EXPEDITION_EXTRAPAYS,
    title: 'International',
    text: 'Expédition entre deux pays',
    art: <GlobeArt />,
    tint: 'bg-teal-50',
    ring: 'ring-teal-100',
  },
];

const PERKS = [
  { icon: Bell, label: 'Suivi à chaque étape', color: 'bg-primary-100 text-primary-600' },
  { icon: MapPinned, label: 'Dépôt en agence ou enlèvement', color: 'bg-teal-100 text-teal-600' },
  { icon: ShieldCheck, label: 'Devis avant de confirmer', color: 'bg-shop-100 text-shop-700' },
];

export default function NewExpeditionPage() {
  return (
    <div>
      <TopBar title="Nouvel envoi" back />
      <div className="page-container space-y-5 py-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-surface-900">Où part votre colis ?</h1>
          <p className="mt-1 text-body text-surface-500">Choisissez le type d'envoi, on calcule le tarif ensuite.</p>
        </div>

        <div className="space-y-3">
          {CHOICES.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className={`group flex items-center gap-4 overflow-hidden rounded-3xl bg-white p-3 pr-4 shadow-card ring-1 transition active:scale-[0.98] ${c.ring}`}
            >
              <span className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl ${c.tint}`}>
                <span className="transition duration-300 group-hover:-translate-y-1">{c.art}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-base font-semibold text-surface-900">{c.title}</span>
                <span className="block text-body text-surface-500">{c.text}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-surface-400 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <ul className="card divide-y divide-surface-100 px-4">
          {PERKS.map((p) => (
            <li key={p.label} className="flex items-center gap-3 py-3">
              <span className={`icon-tile h-9 w-9 rounded-xl ${p.color}`}>
                <p.icon size={17} />
              </span>
              <span className="text-body font-medium text-surface-700">{p.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
