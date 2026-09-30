import { motion } from 'framer-motion';

// Onglets defilables avec indicateur anime (layoutId). `tabs` : [{ key, label, count? }].
export default function SegmentedTabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`relative shrink-0 rounded-full px-3.5 py-2 text-caption font-semibold transition-colors ${
              active ? 'text-white' : 'bg-white text-surface-600 shadow-card hover:text-surface-900'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-full bg-surface-900"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[11px] leading-4 ${
                    active ? 'bg-shop-400 text-shop-950' : 'bg-surface-100 text-surface-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
