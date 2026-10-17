const colors = require('tailwindcss/colors');
/** @type {import('tailwindcss').Config} */
// Direction "Bento nuit" : fond quasi noir bleuté, cartes arrondies, accent rose vif, secondaire bleu.
// On redéfinit les échelles gray / purple / pink / orange (et white) pour restyler tout le site d'un coup :
// gray = encre bleutée, purple = rose (couleur d'action), pink = bleu, orange = orange.
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        white: '#f5f5fa',
        gray: {
          50: '#f8f8fc', 100: '#f0f0f6', 200: '#e0e0ea', 300: '#c4c4d4', 400: '#9a9ab0',
          500: '#6f6f86', 600: '#454558', 700: '#2a2a3a', 800: '#1a1a26', 900: '#0f0f18', 950: '#08080d',
        },
        purple: colors.rose,
        pink: colors.blue,
        orange: colors.orange,
        lime: colors.lime,
        teal: colors.teal,
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        none: '0', sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px', '2xl': '24px', '3xl': '32px', full: '9999px',
      },
      boxShadow: {
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.4)',
        sm: '0 1px 4px rgba(0, 0, 0, 0.4)',
        md: '0 4px 14px rgba(0, 0, 0, 0.45)',
        lg: '0 10px 28px rgba(0, 0, 0, 0.5)',
        xl: '0 16px 40px rgba(0, 0, 0, 0.55)',
        '2xl': '0 24px 60px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
