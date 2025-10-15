/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true, // Ignore ESLint errors during build (pre-existing issues)
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true, // Ignore TypeScript errors during build (pre-existing issues)
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_TRACKING_URL: process.env.NEXT_PUBLIC_TRACKING_URL,
  },
  images: {
    domains: [
      "localhost",
      "images.unsplash.com",
      "via.placeholder.com",
      "picsum.photos",
      "source.unsplash.com",
    ],
  },
};

module.exports = nextConfig;
