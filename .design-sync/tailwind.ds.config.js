// Tailwind config for the design-sync stylesheet: the app's own theme, with the
// authored previews added to `content` so every class they use is compiled.
import app from '../tailwind.config.js';

export default {
  ...app,
  content: ['./src/**/*.{js,ts,jsx,tsx}', './.design-sync/**/*.{js,jsx,ts,tsx}'],
};
