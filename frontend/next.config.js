const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled for BlockNote compatibility
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Add basePath configuration
  basePath: '',
  assetPrefix: '/',

  transpilePackages: ['@blocknote/core', '@blocknote/react', '@blocknote/shadcn'],

  // Add webpack configuration for Tauri
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    // BlockNote CJS bundles import ESM-only @handlewithcare/prosemirror-inputrules
    config.resolve.alias = {
      ...config.resolve.alias,
      '@handlewithcare/prosemirror-inputrules': path.resolve(
        path.dirname(require.resolve('@blocknote/core')),
        '../../../@handlewithcare/prosemirror-inputrules/dist/index.js'
      ),
    };

    return config;
  },
}

module.exports = nextConfig
