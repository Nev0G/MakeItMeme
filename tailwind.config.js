/** @type {import('tailwindcss').Config} */
// Ambiance "Observatoire" (inspirée de Deadlock) : vert nuit, verre dépoli, accent citron, touches d'or.
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
        white: '#f1e9d0', // crème
        // vert-noir (nuit)
        gray: {
          50: '#f6f8f4', 100: '#e8eee9', 200: '#d3dcd6', 300: '#b8c5be', 400: '#9fb0a8',
          500: '#7f918a', 600: '#51635f', 700: '#2a3a39', 800: '#182524', 900: '#0e1818', 950: '#060d0d',
        },
        // citron (couleur d'action principale)
        purple: {
          50: '#f8fded', 100: '#eefac6', 200: '#e4f7a4', 300: '#d9f891', 400: '#c8ee6a',
          500: '#a9d44a', 600: '#7fa22d', 700: '#5f7d22', 800: '#42591a', 900: '#2b3b13', 950: '#161f0a',
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
