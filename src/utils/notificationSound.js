// Sonnerie des notifications (app ouverte), synthetisee avec Web Audio : aucun
// fichier a charger, fonctionne hors ligne, volume constant sur tous les mobiles.
//
// Sonneries :
//   - 'default' : carillon cristallin ascendant (info / succes)
//   - 'alert'   : deux notes descendantes (refus, annulation, probleme)
//   - 'urgent'  : sonnerie double a fort impact (nouvelle mission a accepter vite)
//
// Les navigateurs interdisent de jouer un son avant un geste de l'utilisateur :
// le contexte audio est donc "deverrouille" au premier toucher / clic.
//
// NB : quand l'app est fermee ou en arriere-plan, le son est celui que le systeme
// associe a la notification push (Web Push ne permet pas d'en imposer un). On
// y ajoute vibration + re-alerte depuis le service worker (public/push-sw.js).

const STORAGE_KEY = 'ts-notification-sound';
const THROTTLE_MS = 2000; // evite le double son WebSocket + push pour un meme evenement

let ctx = null;
let bus = null;
let lastAt = 0;
let lastKind = null;

export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* stockage indisponible : la preference ne sera pas conservee */
  }
}

function getContext() {
  if (ctx) return ctx;
  const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtx) return null;
  ctx = new AudioCtx();

  // Chaine de sortie : compresseur (son plein et puissant sans saturation) +
  // petit echo filtre qui donne de la brillance et de la profondeur.
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  const master = ctx.createGain();
  master.gain.value = 0.95;

  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.16;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3800;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;

  bus = ctx.createGain();
  bus.connect(master);
  bus.connect(echo);
  echo.connect(tone);
  tone.connect(feedback);
  feedback.connect(echo);
  tone.connect(wet);
  wet.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return ctx;
}

// Une note : attaque douce de 6 ms (pas de "clic"), decroissance exponentielle,
// plus des harmoniques pour un timbre de cloche / sonnerie plutot qu'un bip nu.
function note(freq, at, dur, { gain = 0.5, type = 'sine', partials = [[2, 0.34], [3, 0.14], [4.2, 0.07]] } = {}) {
  const t0 = ctx.currentTime + at;
  const voices = [[1, 1], ...partials];
  voices.forEach(([ratio, level]) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = ratio === 1 ? type : 'sine';
    osc.frequency.value = freq * ratio;
    const peak = gain * level;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.006);
    // Les harmoniques s'eteignent plus vite que le fondamental (son de cloche).
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / Math.max(1, ratio * 0.6));
    osc.connect(env);
    env.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

const RINGTONES = {
  // Do6 - Mi6 - Sol6 - Do7 : carillon clair, audible meme dans une poche / rue.
  default: () => {
    note(1046.5, 0, 0.9, { gain: 0.5 });
    note(1318.5, 0.13, 0.9, { gain: 0.5 });
    note(1568.0, 0.26, 0.9, { gain: 0.5 });
    note(2093.0, 0.4, 1.4, { gain: 0.55 });
  },
  // Mi6 -> La5 puis Do6 : ton plus grave, attire l'attention sans etre agressif.
  alert: () => {
    note(1318.5, 0, 0.55, { gain: 0.55, type: 'triangle' });
    note(880.0, 0.2, 0.55, { gain: 0.55, type: 'triangle' });
    note(659.3, 0.42, 0.9, { gain: 0.6, type: 'triangle' });
  },
  // Sonnerie "telephone" : deux salves de 3 notes bien detachees (1-3 kHz, la
  // bande la mieux restituee par les haut-parleurs de smartphone), tres audible.
  urgent: () => {
    [0, 1.05].forEach((offset) => {
      note(1318.5, offset, 0.32, { gain: 0.62, type: 'triangle', partials: [[2, 0.3], [3, 0.12]] });
      note(1760.0, offset + 0.18, 0.32, { gain: 0.62, type: 'triangle', partials: [[2, 0.3], [3, 0.12]] });
      note(2093.0, offset + 0.36, 0.7, { gain: 0.7, type: 'triangle', partials: [[2, 0.3], [3, 0.12]] });
    });
  },
};

const VIBRATIONS = {
  default: [120, 60, 120],
  alert: [250, 100, 250],
  urgent: [300, 120, 300, 120, 500],
};

function ring(kind) {
  const audio = getContext();
  if (!audio) return;
  const start = () => (RINGTONES[kind] || RINGTONES.default)();
  if (audio.state === 'running') start();
  else audio.resume().then(() => audio.state === 'running' && start()).catch(() => {});
  try {
    navigator.vibrate?.(VIBRATIONS[kind] || VIBRATIONS.default);
  } catch {
    /* vibration indisponible */
  }
}

/**
 * Joue la sonnerie `kind` ('default' | 'alert' | 'urgent') si le son est active.
 * Anti-rafale : un meme evenement relaye par le WebSocket ET le push ne sonne
 * qu'une fois ; seule une sonnerie 'urgent' peut passer outre une plus douce.
 */
export function playNotificationSound(kind = 'default') {
  if (!isSoundEnabled()) return;
  const now = Date.now();
  const recent = now - lastAt < THROTTLE_MS;
  if (recent && !(kind === 'urgent' && lastKind !== 'urgent')) return;
  lastAt = now;
  lastKind = kind;
  ring(kind);
}

/** Apercu depuis les reglages (ignore la preference et l'anti-rafale). */
export function previewNotificationSound(kind = 'default') {
  lastAt = 0;
  ring(kind);
}

// Deverrouillage au premier geste (politique d'autoplay des navigateurs).
if (typeof window !== 'undefined') {
  const unlock = () => {
    const audio = getContext();
    if (audio && audio.state !== 'running') audio.resume().catch(() => {});
    if (audio?.state === 'running' || !audio) {
      ['pointerdown', 'touchend', 'keydown'].forEach((evt) => window.removeEventListener(evt, unlock, true));
    }
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((evt) => window.addEventListener(evt, unlock, true));
}
