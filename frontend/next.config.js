/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
