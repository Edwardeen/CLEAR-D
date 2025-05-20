/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**', // Allows any path under this hostname
      },
    ],
  },
  transpilePackages: ['chart.js', 'chartjs-adapter-date-fns', 'date-fns'],
};

module.exports = nextConfig; 