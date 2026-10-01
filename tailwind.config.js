/** @type {import('tailwindcss').Config} */
// Ambiance "observatoire" : gris vert très sombre, laiton, teal. On redéfinit les
// échelles gray / purple / pink pour restyler tout le site d'un coup.
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
        gray: {
          50: '#f4f8f2', 100: '#e8f0e6', 200: '#d3e0d4', 300: '#b7cabb', 400: '#92aa9b',
          500: '#6f8b7c', 600: '#4f6b5c', 700: '#2a4036', 800: '#1a2c25', 900: '#101d19', 950: '#09130f',
        },
        // laiton / or ancien (couleur d'action principale)
        purple: {
          50: '#fbf6e6', 100: '#f4e8c4', 200: '#ead49a', 300: '#e3c27a', 400: '#d6a948',
          500: '#c28f2c', 600: '#a8751f', 700: '#865a1a', 800: '#5f4116', 900: '#3d2a12', 950: '#241808',
        },
        // teal profond (accent secondaire)
        pink: {
          50: '#ecfaf7', 100: '#cdf2ea', 200: '#9fe5d7', 300: '#6fd4c3', 400: '#43bfaa',
          500: '#2aa897', 600: '#1f8a7c', 700: '#1b6e65', 800: '#17524d', 900: '#123a38', 950: '#0a2322',
        },
        parchment: { 100: '#efe4c4', 200: '#e1d2a6', 300: '#d2bf8b', 400: '#b8a272', 700: '#5b4a2c', 900: '#2a2114' },
      },
    },
  },
  plugins: [],
}
