/** @type {import('tailwindcss').Config} */
// Ambiance "Deadlock" : New York occulte années 20, noir profond, or art déco, lueurs turquoise.
// On redéfinit les échelles gray / purple / pink (et white) pour restyler tout le site d'un coup.
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
        white: '#efe4c6', // blanc cassé chaud, comme de l'ivoire
        // noir bleuté, un peu de vert (nuit new-yorkaise)
        gray: {
          50: '#f4efe2', 100: '#e6dfcc', 200: '#d0c7ae', 300: '#b9b199', 400: '#a5a28f',
          500: '#8a8b7d', 600: '#5f696b', 700: '#2e3a3e', 800: '#1b2529', 900: '#10171a', 950: '#080c0e',
        },
        // or art déco (couleur d'action principale)
        purple: {
          50: '#fbf6e6', 100: '#f6ebc3', 200: '#efd995', 300: '#e8c66a', 400: '#dcae45',
          500: '#c99a2e', 600: '#a8751f', 700: '#865a1a', 800: '#5f4116', 900: '#3d2a12', 950: '#241808',
        },
        // âmes turquoise (accent secondaire)
        pink: {
          50: '#ecfaf7', 100: '#cdf2ea', 200: '#9fe5d7', 300: '#6fd4c3', 400: '#43bfaa',
          500: '#2aa897', 600: '#1f8a7c', 700: '#1b6e65', 800: '#17524d', 900: '#123a38', 950: '#0a2322',
        },
      },
      fontFamily: {
        mono: ['"Courier Prime"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        none: '0', sm: '1px', DEFAULT: '2px', md: '2px', lg: '3px', xl: '4px', '2xl': '4px', '3xl': '6px', full: '9999px',
      },
      boxShadow: {
        // ombres profondes avec une pointe de lueur dorée
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.55)',
        sm: '0 1px 4px rgba(0, 0, 0, 0.5)',
        md: '0 3px 12px rgba(0, 0, 0, 0.55)',
        lg: '0 6px 20px rgba(0, 0, 0, 0.6), 0 0 14px rgba(201, 154, 46, 0.08)',
        xl: '0 10px 28px rgba(0, 0, 0, 0.65), 0 0 18px rgba(201, 154, 46, 0.1)',
        '2xl': '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(201, 154, 46, 0.12)',
      },
    },
  },
  plugins: [],
}
