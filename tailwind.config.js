const defaultColors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
// Thème "vieux journal" : le site a été écrit pour un fond sombre (bg-gray-900, text-white,
// text-purple-300...). Plutôt que de réécrire chaque classe, on INVERSE les échelles de
// couleurs : les teintes sombres deviennent du papier, les claires deviennent de l'encre.
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const reverse = (scale) =>
  Object.fromEntries(STEPS.map((step, i) => [step, scale[STEPS[STEPS.length - 1 - i]]]));

const families = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'fuchsia', 'rose'];
const inverted = Object.fromEntries(families.map((name) => [name, reverse(defaultColors[name])]));

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
        ...inverted,
        white: '#1a140b', // l'encre
        // papier -> encre
        gray: {
          50: '#14100a', 100: '#1d180e', 200: '#2a2316', 300: '#3a3120', 400: '#4f442b',
          500: '#6a5d3c', 600: '#85774f', 700: '#a89868', 800: '#d3c496', 900: '#e6d9b4', 950: '#f4ecd3',
        },
        // or fané / laiton (action principale) : texte sombre aux petites valeurs, fond clair aux grandes
        purple: {
          50: '#2b1d04', 100: '#3d2a08', 200: '#55390a', 300: '#6f4a0c', 400: '#8f620e',
          500: '#c99a2e', 600: '#d8ad45', 700: '#e6c872', 800: '#efdba0', 900: '#f5e8bd', 950: '#faf1d6',
        },
        // vert-de-gris / encre bleu-vert
        pink: {
          50: '#06201d', 100: '#0a2e2a', 200: '#0f423c', 300: '#14584f', 400: '#1b7367',
          500: '#3fa293', 600: '#5db8aa', 700: '#8bd0c4', 800: '#b8e2da', 900: '#d6efe9', 950: '#eaf7f4',
        },
      },
      fontFamily: {
        mono: ['"Courier Prime"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        none: '0', sm: '1px', DEFAULT: '2px', md: '2px', lg: '2px', xl: '3px', '2xl': '3px', '3xl': '4px', full: '9999px',
      },
      boxShadow: {
        // ombres "imprimées" : décalées, nettes
        DEFAULT: '2px 2px 0 rgba(26, 20, 11, 0.25)',
        sm: '1px 1px 0 rgba(26, 20, 11, 0.25)',
        md: '2px 2px 0 rgba(26, 20, 11, 0.28)',
        lg: '3px 3px 0 rgba(26, 20, 11, 0.3)',
        xl: '4px 4px 0 rgba(26, 20, 11, 0.32)',
        '2xl': '5px 5px 0 rgba(26, 20, 11, 0.35)',
      },
    },
  },
  plugins: [],
}
