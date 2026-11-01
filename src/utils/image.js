// Compression d'une photo avant envoi (limite API : 5 Mo). Les photos de
// telephone font souvent 5 a 12 Mo : on les reduit (cote max 1800 px, JPEG 82 %).
// Les petits fichiers sont laisses tels quels ; en cas d'echec, l'original est
// renvoye (l'appelant verifie alors la taille).

const SKIP_BELOW = 1.5 * 1024 * 1024;

const load = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image illisible')); };
  img.src = url;
});

export async function compressImage(file, { maxSide = 1800, quality = 0.82 } = {}) {
  if (!file || file.size <= SKIP_BELOW) return file;
  try {
    const img = await load(file);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG transparent -> fond blanc en JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', quality); });
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
