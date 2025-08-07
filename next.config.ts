import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: false,
  },
  env: {
    SKIP_ENV_VALIDATION: '1',
  },
  webpack: (config, { isServer }) => {
    // Disable webpack cache for Cloudflare Pages
    config.cache = false;
    return config;
  },
};

export default nextConfig;
