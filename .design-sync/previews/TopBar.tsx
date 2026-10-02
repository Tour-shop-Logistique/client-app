import { TopBar, ShoppingCart, Share2 } from 'client-app';

const Frame = ({ children }) => <div className="max-w-md bg-surface-50 pb-4">{children}</div>;

export const Simple = () => (
  <Frame>
    <TopBar title="Mes colis" />
  </Frame>
);

export const AvecRetour = () => (
  <Frame>
    <TopBar title="Nouvelle expédition" back />
  </Frame>
);

export const AvecActions = () => (
  <Frame>
    <TopBar
      title="E-commerce"
      back
      right={
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-full p-2 text-surface-600 hover:bg-surface-100" aria-label="Partager"><Share2 size={20} /></button>
          <button type="button" className="relative rounded-full p-2 text-surface-600 hover:bg-surface-100" aria-label="Panier">
            <ShoppingCart size={20} />
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-shop-400 px-1 text-[10px] font-bold text-shop-950">2</span>
          </button>
        </div>
      }
    />
  </Frame>
);
