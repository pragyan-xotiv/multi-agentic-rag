/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['cdn.example.com'],
    formats: ['image/avif', 'image/webp'],
  },
  // Optimize for Vercel deployment
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Enable automatic static optimization
  output: 'standalone',
};

module.exports = nextConfig; 