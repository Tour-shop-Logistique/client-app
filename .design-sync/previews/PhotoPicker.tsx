import { useState } from 'react';
import { MotionGlobalConfig, PhotoPicker } from 'client-app';

// Static card: jump framer-motion entry animations to their end state.
MotionGlobalConfig.skipAnimations = true;

// Real File objects from inline SVGs (what the picker gets from <input type="file">).
const file = (color, name) =>
  new File(
    [`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${color}"/><circle cx="150" cy="140" r="70" fill="rgba(255,255,255,0.3)"/></svg>`],
    name,
    { type: 'image/svg+xml', lastModified: 1 },
  );

export const Vide = () => {
  const [files, setFiles] = useState([]);
  return (
    <div className="max-w-sm">
      <PhotoPicker files={files} onChange={setFiles} />
    </div>
  );
};

export const AvecPhotos = () => {
  const [files, setFiles] = useState(() => [file('#156fbe', 'face.svg'), file('#159faf', 'dos.svg'), file('#a3b01e', 'detail.svg')]);
  return (
    <div className="max-w-sm">
      <PhotoPicker files={files} onChange={setFiles} max={6} />
    </div>
  );
};
