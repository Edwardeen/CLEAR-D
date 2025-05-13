/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // If using App Router
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