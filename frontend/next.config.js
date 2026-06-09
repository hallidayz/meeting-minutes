const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the "Next.js X.X (stale) / Webpack" badge in the Tauri webview (errors still surface)
  devIndicators: false,
  reactStrictMode: false, // Disabled for BlockNote compatibility
  // Static export is for Tauri production builds only — enabling in dev breaks chunk loading
  ...(isProd ? { output: 'export' } : {}),
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
