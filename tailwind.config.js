/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // If using App Router
  ],
  safelist: [
    'text-red-600', 'bg-red-50',
    'text-orange-600', 'bg-orange-50',
    'text-yellow-600', 'bg-yellow-50',
    'text-green-600', 'bg-green-50',
    'text-emerald-600', 'bg-emerald-50',
  ],
  theme: {
    extend: {
      colors: {
        // Add custom colors if needed, e.g.:
        // primary: '#1d4ed8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Example: using Inter font
      },
    },
  },
  plugins: [],
} 