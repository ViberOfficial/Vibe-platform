/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-900': '#0a0a0f',
        'dark-800': '#1a1a24',
        'dark-700': '#2a2a35',
        'vibe-500': '#a855f7',
        'vibe-600': '#9333ea',
        'vibe-700': '#7e22ce',
        'vibe-400': '#d8b4fe',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'glass-light': 'rgba(255, 255, 255, 0.1)',
        'glass-dark': 'rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
