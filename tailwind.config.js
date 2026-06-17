/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted Barlow (see src/index.css @font-face). System fallback only.
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
      colors: {
        pcl: {
          yellow: '#FFC425',
          green: '#005D2F',
          // grays
          dark: '#36383D',
          mid: '#A6A6A6',
          light: '#CFCFCF',
          // secondary — callouts/buttons/chips only
          indigo: '#4E5BA8',
          'light-green': '#098371',
          purple: '#941F6E',
          // RESERVED: alerts only (during-season overload guardrail)
          orange: '#D83C31',
        },
      },
    },
  },
  plugins: [],
}
