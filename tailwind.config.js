/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette sourced from the TourShop logomark (feather: navy base ->
        // teal -> cyan -> lime tip, "Tour" wordmark blue, "Shop" wordmark lime).
        primary: {
          50: '#eff7fe',
          100: '#dceefc',
          200: '#b7ddfa',
          300: '#82c3f5',
          400: '#47a3eb',
          500: '#2185d6',
          600: '#156fbe',
          700: '#10589a',
          800: '#12477b',
          900: '#143c64',
          950: '#0c2540',
        },
        teal: {
          50: '#edfbfc',
          100: '#d3f5f8',
          200: '#a9eaf0',
          300: '#71d9e3',
          400: '#34bfcc',
          500: '#159faf',
          600: '#10808d',
          700: '#126672',
          800: '#15525c',
          900: '#16444c',
          950: '#07282e',
        },
        navy: {
          50: '#eeeef6',
          100: '#dfdeee',
          200: '#c1bfdf',
          300: '#9e9bcb',
          400: '#7a75b3',
          500: '#5c5599',
          600: '#453d80',
          700: '#363065',
          800: '#2b2650',
          900: '#241f41',
          950: '#16132a',
        },
        // Marketplace-only accent, matching the "Shop" wordmark's olive-lime.
        shop: {
          50: '#fafbe7',
          100: '#f2f6c4',
          200: '#e5ee8f',
          300: '#d2e052',
          400: '#bdce2e',
          500: '#a3b01e',
          600: '#808c17',
          700: '#636b16',
          800: '#505619',
          900: '#45491b',
          950: '#24270a',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'bottom-nav': '4.25rem',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      // Typographic scale: nothing below 12px.
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        title: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        display: ['1.5rem', { lineHeight: '1.875rem', fontWeight: '700' }],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'nav': '0 -2px 12px rgba(15, 23, 42, 0.06)',
        'card': '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'brand': '0 8px 24px -8px rgba(21, 111, 190, 0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'sheet-up': 'sheetUp 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        sheetUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
