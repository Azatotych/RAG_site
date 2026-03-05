/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Golos Text"', '"Golos"', 'system-ui', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'],
        display: ['"Tektur"', '"Golos Text"', 'system-ui', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
