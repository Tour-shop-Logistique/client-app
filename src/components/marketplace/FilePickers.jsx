import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ImagePlus, X, Star, Receipt } from 'lucide-react';
import { toast } from 'sonner';

export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/jpg,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

// Filtre cote client selon les contraintes API (jpeg/png/jpg/webp, 5 Mo max).
const validImages = (files) =>
  files.filter((f) => {
    if (!/^image\/(jpeg|png|jpg|webp)$/.test(f.type)) {
      toast.error(`${f.name} : format non accepté (jpeg, png, webp).`);
      return false;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`${f.name} dépasse 5 Mo.`);
      return false;
    }
    return true;
  });

const useObjectUrls = (files) => {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
};

// Selection multiple de photos (max `max`). La 1re est la couverture.
export function PhotoPicker({ files, onChange, max = 10 }) {
  const inputRef = useRef(null);
  const urls = useObjectUrls(files);

  const add = (list) => {
    const next = [...files, ...validImages([...list])];
    if (next.length > max) toast.warning(`${max} photos maximum.`);
    onChange(next.slice(0, max));
  };

  const makeCover = (i) => onChange([files[i], ...files.filter((_, j) => j !== i)]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <AnimatePresence>
          {files.map((file, i) => (
            <motion.div
              key={`${file.name}-${file.lastModified}-${file.size}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="group relative aspect-square overflow-hidden rounded-xl bg-surface-100"
            >
              <img src={urls[i]} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute bottom-1 left-1 rounded-full bg-shop-400 px-2 py-0.5 text-[11px] font-bold text-shop-950">
                  Couverture
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur"
                >
                  <Star size={10} /> Couverture
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white backdrop-blur"
                aria-label="Retirer la photo"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {files.length < max && (
          <motion.button
            layout
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-shop-300 bg-shop-50 text-shop-800 transition hover:bg-shop-100"
          >
            {files.length === 0 ? <Camera size={24} /> : <ImagePlus size={22} />}
            <span className="text-caption font-semibold">{files.length === 0 ? 'Ajouter' : `${files.length}/${max}`}</span>
          </motion.button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files ?? []);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// Image unique optionnelle : preuve de paiement (capture d'ecran) ou photo d'un
// colis (`icon` Camera, `capture="environment"` pour ouvrir l'appareil photo).
export function ProofPicker({
  file, onChange, label = 'Capture de la transaction', icon = Receipt, removeLabel = 'Retirer la preuve', capture,
}) {
  const Icon = icon;
  const inputRef = useRef(null);
  const [url] = useObjectUrls(useMemo(() => (file ? [file] : []), [file]));

  return (
    <div>
      {file ? (
        <div className="relative overflow-hidden rounded-xl border border-surface-200">
          <img src={url} alt="Preuve" className="max-h-48 w-full object-contain bg-surface-50" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white"
            aria-label={removeLabel}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-surface-200 p-3.5 text-left transition hover:border-primary-300 hover:bg-primary-50/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon size={18} />
          </span>
          <span>
            <span className="block text-body font-medium text-surface-900">{label}</span>
            <span className="block text-caption text-surface-500">Optionnel · jpeg, png, webp · 5 Mo max</span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const [f] = validImages([...(e.target.files ?? [])]);
          if (f) onChange(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
