/** @type {import('tailwindcss').Config} */
// Ambiance "Speakeasy" : bois de noyer, cadres en laiton, parchemin, gemmes colorées.
// On redéfinit les échelles gray / purple / pink / orange (et white) pour restyler tout le site d'un coup :
// gray = bois, purple = laiton (action), pink = émeraude, orange = cuivre.
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
        white: '#f3e6c8', // parchemin
        // bois sombre (noyer) : fonds, cadres, textes secondaires
        gray: {
          50: '#f8f2e4', 100: '#efe6d2', 200: '#e0d3b8', 300: '#cdbb9b', 400: '#b09a7a',
          500: '#8f785a', 600: '#6a5238', 700: '#443020', 800: '#2b1c12', 900: '#1b110a', 950: '#0d0805',
        },
        // laiton (couleur d'action principale)
        purple: {
          50: '#fdf8e6', 100: '#f9edc0', 200: '#f3df94', 300: '#ecce6e', 400: '#e0b552',
          500: '#c9953a', 600: '#a67526', 700: '#805a1d', 800: '#5a3f15', 900: '#3c2a0e', 950: '#201507',
        },
        // émeraude (accent secondaire, gemmes)
        pink: {
          50: '#ecf8f1', 100: '#cdeedd', 200: '#9fdfbf', 300: '#6fcd9f', 400: '#3fae7d',
          500: '#2f9468', 600: '#247653', 700: '#1d5c42', 800: '#174834', 900: '#10342a', 950: '#09211a',
        },
        // cuivre (imposteur)
        orange: {
          50: '#fcf1e6', 100: '#f8dcc0', 200: '#f0bd8a', 300: '#e69d59', 400: '#da7f38',
          500: '#c9661f', 600: '#ad531a', 700: '#8a4118', 800: '#6a3217', 900: '#4a2411', 950: '#2a1409',
        },
        // lime / teal (utilisés par Bomb Party) suivent la palette : laiton et émeraude
        lime: {
          50: '#fdf8e6', 100: '#f9edc0', 200: '#f3df94', 300: '#ecce6e', 400: '#e0b552',
          500: '#c9953a', 600: '#a67526', 700: '#805a1d', 800: '#5a3f15', 900: '#3c2a0e', 950: '#201507',
        },
        teal: {
          50: '#ecf8f1', 100: '#cdeedd', 200: '#9fdfbf', 300: '#6fcd9f', 400: '#3fae7d',
          500: '#2f9468', 600: '#247653', 700: '#1d5c42', 800: '#174834', 900: '#10342a', 950: '#09211a',
        },
      },
      fontFamily: {
        mono: ['"Courier Prime"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        none: '0', sm: '4px', DEFAULT: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '28px', full: '9999px',
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
