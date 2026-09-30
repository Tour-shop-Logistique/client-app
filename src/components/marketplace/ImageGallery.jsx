import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ZoomIn, ImageOff } from 'lucide-react';
import { handleMediaError } from '../../utils/marketplace';

const SWIPE = 60;

const variants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0.4 }),
};

function Slides({ photos, index, direction, onPaginate, onTap, zoomed = false, fit = 'cover' }) {
  const photo = photos[index];
  return (
    <AnimatePresence initial={false} custom={direction} mode="popLayout">
      <motion.img
        key={photo.id ?? index}
        src={photo.url}
        alt=""
        onError={handleMediaError}
        custom={direction}
        variants={variants}
        initial="enter"
        animate={{ ...variants.center, scale: zoomed ? 2.2 : 1 }}
        exit="exit"
        transition={{ x: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: 0.2 }, scale: { duration: 0.25 } }}
        drag={zoomed ? true : 'x'}
        dragConstraints={zoomed ? { left: -200, right: 200, top: -200, bottom: 200 } : { left: 0, right: 0 }}
        dragElastic={zoomed ? 0.2 : 0.8}
        onDragEnd={(_, { offset, velocity }) => {
          if (zoomed) return;
          const power = offset.x + velocity.x * 0.2;
          if (power < -SWIPE) onPaginate(1);
          else if (power > SWIPE) onPaginate(-1);
        }}
        onTap={onTap}
        draggable={false}
        className={`absolute inset-0 h-full w-full select-none ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${zoomed ? 'cursor-grab' : 'cursor-zoom-in'}`}
      />
    </AnimatePresence>
  );
}

function Lightbox({ photos, start, onClose }) {
  const [[index, direction], setPage] = useState([start, 0]);
  const [zoomed, setZoomed] = useState(false);

  const paginate = (dir) => {
    setZoomed(false);
    setPage(([i]) => [(i + dir + photos.length) % photos.length, dir]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') paginate(1);
      if (e.key === 'ArrowLeft') paginate(-1);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="safe-top flex items-center justify-between p-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-caption">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <Slides
          photos={photos}
          index={index}
          direction={direction}
          onPaginate={paginate}
          onTap={() => setZoomed((z) => !z)}
          zoomed={zoomed}
          fit="contain"
        />
      </div>
      <p className="safe-bottom p-4 text-center text-caption text-white/60">
        Touchez pour zoomer · glissez pour naviguer
      </p>
    </motion.div>,
    document.body
  );
}

// Galerie produit : swipe, fleches (desktop), miniatures, plein ecran + zoom.
export default function ImageGallery({ photos, overlay = null }) {
  const [[index, direction], setPage] = useState([0, 0]);
  const [lightbox, setLightbox] = useState(false);

  if (!photos.length) {
    return (
      <div className="relative flex aspect-square w-full items-center justify-center bg-gradient-to-br from-surface-100 to-surface-200 text-surface-400">
        <ImageOff size={40} />
        {overlay}
      </div>
    );
  }

  const paginate = (dir) => setPage(([i]) => [(i + dir + photos.length) % photos.length, dir]);
  const goTo = (i) => setPage(([cur]) => [i, i > cur ? 1 : -1]);

  return (
    <div>
      <div className="group relative aspect-square w-full overflow-hidden bg-surface-100">
        <Slides photos={photos} index={index} direction={direction} onPaginate={paginate} onTap={() => setLightbox(true)} />

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => paginate(-1)}
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-card backdrop-blur transition hover:bg-white sm:group-hover:inline-flex"
              aria-label="Photo précédente"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => paginate(1)}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-card backdrop-blur transition hover:bg-white sm:group-hover:inline-flex"
              aria-label="Photo suivante"
            >
              <ChevronRight size={18} />
            </button>
            <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((p, i) => (
                <motion.span
                  key={p.id ?? i}
                  animate={{ width: i === index ? 18 : 6, opacity: i === index ? 1 : 0.6 }}
                  className="h-1.5 rounded-full bg-white shadow"
                />
              ))}
            </div>
          </>
        )}

        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur">
          <ZoomIn size={12} /> Agrandir
        </span>
        {overlay}
      </div>

      {photos.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
          {photos.map((p, i) => (
            <button
              key={p.id ?? i}
              type="button"
              onClick={() => goTo(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                i === index ? 'ring-shop-400' : 'opacity-60 ring-transparent hover:opacity-100'
              }`}
              aria-label={`Photo ${i + 1}`}
            >
              <img src={p.url} alt="" onError={handleMediaError} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightbox && <Lightbox photos={photos} start={index} onClose={() => setLightbox(false)} />}
      </AnimatePresence>
    </div>
  );
}
