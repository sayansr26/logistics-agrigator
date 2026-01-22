/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://api-gateway:3001/api/v1/:path*",
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: "",
    NEXT_PUBLIC_TRACKING_URL: "/tracking",
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
