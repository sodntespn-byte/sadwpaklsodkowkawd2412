/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        liberty: {
          black: '#000000',
          'black-soft': '#0a0a0a',
          'black-light': '#111111',
          'black-lighter': '#1a1a1a',
          'black-card': '#222222',
          yellow: '#FFFF00',
          'yellow-gold': '#FFD700',
          'yellow-muted': '#B8860B',
          'yellow-border': '#A07D0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(255, 255, 0, 0.3)' },
          '50%': { opacity: '0.9', boxShadow: '0 0 30px rgba(255, 255, 0, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
