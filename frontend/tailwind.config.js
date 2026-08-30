/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nyaya: {
          dark: '#0f172a',
          navy: '#1e293b',
          gold: '#d97706',
          amber: '#f59e0b',
          shield: '#0284c7',
        }
      }
    },
  },
  plugins: [],
}
