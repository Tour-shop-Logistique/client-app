// Brouillons de formulaire qui survivent a un rechargement de la page (onglet
// mis en arriere-plan puis tue par le systeme, surtout sur Android).
// Texte -> localStorage ; fichiers (photos) -> IndexedDB, qui accepte les File.
// Toutes les erreurs sont avalees : un brouillon perdu ne doit jamais bloquer.

export const loadJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
};

export const saveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage plein ou indisponible : non bloquant
  }
};

const DB_NAME = 'tourshop-drafts';
const STORE = 'files';

const openDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async (mode, fn) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

// Valeur quelconque clonable (objets imbriques, File compris).
export const loadValue = async (key) => {
  try {
    return (await run('readonly', (s) => s.get(key))) ?? null;
  } catch {
    return null;
  }
};

export const saveValue = async (key, value) => {
  try {
    await run('readwrite', (s) => (value == null ? s.delete(key) : s.put(value, key)));
  } catch {
    // non bloquant
  }
};

export const loadFiles = async (key) => {
  const files = await loadValue(key);
  return Array.isArray(files) ? files : [];
};

export const saveFiles = (key, files) => saveValue(key, files.length ? files : null);

export const clearDraft = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // non bloquant
  }
  saveFiles(key, []);
};
