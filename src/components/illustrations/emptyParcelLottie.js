// Animation Lottie de l'état vide « aucun colis » : le carton du kit visuel
// (voir BoxArt / EmptyParcelArt) rebondit pendant qu'une loupe cherche et que
// deux étincelles scintillent. Construite ici plutôt qu'exportée d'After
// Effects pour garder la palette de l'app et un fichier léger.
// Canevas 200 × 160, 30 i/s, boucle de 3 s (deux rebonds).

const FRAMES = 90;

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

const KRAFT = { top: '#f0c88d', left: '#dba25c', right: '#c4873f' };
const BLUE = '#156fbe';
const LIME = '#bdce2e';

const still = (k) => ({ a: 0, k });
const EASE = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
// keys : [[frame, valeur], ...] — easing doux entre chaque clé.
const anim = (keys) => ({
  a: 1,
  k: keys.map(([t, s], idx) => (idx === keys.length - 1 ? { t, s } : { t, s, ...EASE })),
});

const transform = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr', p: still(p), a: still(a), s: still(s), r: still(r), o: still(o), sk: still(0), sa: still(0),
});

const path = (v, closed = true) => ({
  ty: 'sh',
  ks: still({ i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), v, c: closed }),
});
const fill = (hex, o = 100) => ({ ty: 'fl', c: still(rgb(hex)), o: still(o), r: 1 });
const stroke = (hex, w) => ({ ty: 'st', c: still(rgb(hex)), o: still(100), w: still(w), lc: 2, lj: 2 });
const group = (items) => ({ ty: 'gr', it: [...items, transform()] });

let ind = 0;
const layer = (nm, ks, shapes) => {
  ind += 1;
  return {
    ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0,
    ks: { o: still(100), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...ks },
    shapes,
  };
};

// Rebond du carton sur 45 images, joué deux fois : montée, chute,
// écrasement à l'atterrissage, retour au repos.
const hop = (offset) => [
  [offset, 126], [offset + 14, 104], [offset + 26, 126],
];
const squash = (offset) => [
  [offset + 24, [100, 100, 100]], [offset + 29, [112, 88, 100]], [offset + 37, [96, 104, 100]], [offset + 44, [100, 100, 100]],
];
const shadowScale = (offset) => [
  [offset, [100, 100, 100]], [offset + 14, [68, 68, 100]], [offset + 26, [100, 100, 100]],
];

const sparkle = (nm, hex, pos, delay) => layer(nm, {
  p: still([...pos, 0]),
  s: anim([
    [0, [0, 0, 100]], [delay, [0, 0, 100]], [delay + 12, [100, 100, 100]], [delay + 24, [0, 0, 100]], [FRAMES, [0, 0, 100]],
  ]),
  r: anim([[0, 0], [FRAMES, 90]]),
}, [group([
  path([[0, -8], [2, -2], [8, 0], [2, 2], [0, 8], [-2, 2], [-8, 0], [-2, -2]]),
  fill(hex),
])]);

ind = 0;
const layers = [
  sparkle('Étincelle verte', LIME, [42, 38], 6),
  sparkle('Étincelle bleue', BLUE, [166, 116], 40),

  layer('Loupe', {
    p: anim([[0, [150, 50, 0]], [22, [160, 60, 0]], [45, [146, 66, 0]], [67, [156, 46, 0]], [FRAMES, [150, 50, 0]]]),
    r: anim([[0, -8], [45, 10], [FRAMES, -8]]),
  }, [
    group([path([[9, 9], [19, 19]], false), stroke(BLUE, 6)]),
    group([{ ty: 'el', p: still([0, 0]), s: still([26, 26]) }, stroke(BLUE, 5), fill('#ffffff')]),
  ]),

  layer('Carton', {
    a: still([0, 26, 0]),
    p: anim([...hop(0), ...hop(45), [FRAMES, 126]].map(([t, y]) => [t, [96, y, 0]])),
    s: anim([...squash(0), ...squash(45)]),
  }, [
    group([path([[-14, -22], [14, -10], [14, -2]], false), { ...stroke('#ffffff', 4), o: still(75) }]),
    group([path([[0, -28], [28, -16], [0, -4], [-28, -16]]), fill(KRAFT.top)]),
    group([path([[28, -16], [0, -4], [0, 26], [28, 14]]), fill(KRAFT.right)]),
    group([path([[-28, -16], [0, -4], [0, 26], [-28, 14]]), fill(KRAFT.left)]),
  ]),

  layer('Ombre', {
    p: still([96, 130, 0]),
    s: anim([...shadowScale(0), ...shadowScale(45), [FRAMES, [100, 100, 100]]]),
  }, [group([{ ty: 'el', p: still([0, 0]), s: still([70, 9]) }, fill('#0f172a', 12)])]),

  layer('Fond', { p: still([100, 82, 0]) }, [
    group([{ ty: 'el', p: still([0, 0]), s: still([124, 124]) }, fill('#eff7fe')]),
  ]),
];

const emptyParcelLottie = {
  v: '5.7.4', fr: 30, ip: 0, op: FRAMES, w: 200, h: 160, nm: 'Aucun colis', ddd: 0, assets: [], layers,
};

export default emptyParcelLottie;
