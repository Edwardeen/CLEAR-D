/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // If using App Router
    './utils/**/*.{js,ts,jsx,tsx}', // If you have utils that generate classes
  ],
  safelist: [
    // Generate classes for multiple shades
    ...['red', 'orange', 'yellow', 'green', 'emerald', 'blue', 'purple', 'pink', 'gray'].flatMap((color) => 
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].flatMap((shade) => [
        `text-${color}-${shade}`,
        `bg-${color}-${shade}`,
        `border-${color}-${shade}`,
        `ring-${color}-${shade}`,
        `hover:bg-${color}-${shade + 100 > 900 ? 900 : shade + 100}`, // Example for hover states
        `focus:ring-${color}-${shade}` // Example for focus states
      ])
    ),
    // You can still add specific one-off classes if needed
    'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
    'font-bold', 'font-semibold', 'font-medium', 'font-normal',
    'rounded-lg', 'rounded-md', 'rounded-full',
    'shadow-sm', 'shadow-md', 'shadow-lg',
    'bg-red-200',
    'bg-yellow-200',
    'bg-green-200',
    'bg-blue-200', // Added blue as a potential fallback or other type
    'bg-pink-200', // Added pink for cancer type
    'bg-red-100',
    'bg-yellow-100',
    'bg-green-100',
    'bg-blue-100',
    'bg-pink-100',
    // Add any other specific dynamic classes you expect
    // For example, if your getGlaucomaScoreColor and getCancerScoreColor can produce other shades:
    'bg-red-500', 'text-white', // from getCancerScoreColor
    'bg-yellow-500', 'text-black', // from getCancerScoreColor
    'bg-green-500', 'text-white', // from getCancerScoreColor & getGlaucomaScoreColor
    'bg-red-600', // from getGlaucomaScoreColor
    'bg-orange-500', // from getGlaucomaScoreColor
    'bg-yellow-400', // from getGlaucomaScoreColor
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