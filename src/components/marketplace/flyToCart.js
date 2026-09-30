// Animation "ajout au panier" : clone l'image source et la fait voler vers
// l'icone panier visible (element marque `data-cart-target`). Sans cible ou
// si l'utilisateur prefere moins d'animations, ne fait rien.
export default function flyToCart(sourceEl) {
  if (!sourceEl || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const target = [...document.querySelectorAll('[data-cart-target]')].find((el) => el.offsetParent !== null);
  if (!target) return;

  const from = sourceEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, 96);

  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;border-radius:16px;overflow:hidden;
    left:${from.left + from.width / 2 - size / 2}px;top:${from.top + from.height / 2 - size / 2}px;
    width:${size}px;height:${size}px;box-shadow:0 12px 32px -8px rgba(15,23,42,.45);background:#e5ee8f;`;
  if (sourceEl.tagName === 'IMG' && sourceEl.src) {
    const img = document.createElement('img');
    img.src = sourceEl.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    ghost.appendChild(img);
  }
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(.7)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.3 },
    ],
    { duration: 700, easing: 'cubic-bezier(.5,0,.25,1)' }
  );
  anim.onfinish = () => {
    ghost.remove();
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: 350, easing: 'ease-out' }
    );
  };
}
