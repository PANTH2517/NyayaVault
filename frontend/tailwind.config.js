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
      },
      transitionTimingFunction: {
        'cinematic': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.45, 0.64, 1)',
        'smooth': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'destabilize': 'cubic-bezier(0.36, 0, 0.66, -0.56)',
      },
      transitionDuration: {
        'micro': '150ms',
        'standard': '300ms',
        'cinematic': '500ms',
        'hero': '1200ms',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in-scale': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'status-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(0.98)' },
        },
        'shudder': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-3px)' },
          '40%, 80%': { transform: 'translateX(3px)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-scale': 'fade-in-scale 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'status-pulse': 'status-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shudder': 'shudder 400ms cubic-bezier(0.36, 0, 0.66, -0.56) forwards',
      },
    },
  },
  plugins: [],
}
