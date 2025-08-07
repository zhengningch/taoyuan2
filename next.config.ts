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
    webpackBuildWorker: false,
  },
  env: {
    SKIP_ENV_VALIDATION: '1',
  },
  webpack: (config, { isServer }) => {
    // Disable webpack cache for Cloudflare Pages
    config.cache = false;
    // Disable filesystem cache
    config.infrastructureLogging = { level: 'error' };
    // Remove any existing cache configuration
    if (config.cache && typeof config.cache === 'object') {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
