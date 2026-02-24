/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

let appVersion = '100.0.3';

function extractLatestVersionFromChangelog(content) {
  const match = content.match(/^## \[([\d.]+)\] - \d{4}-\d{2}-\d{2}/m);
  return match?.[1]?.trim() || null;
}

try {
  const changelogPaths = [
    path.join(__dirname, 'CHANGELOG'),
    path.join(__dirname, 'CHANGELOG.md'),
  ];

  for (const changelogPath of changelogPaths) {
    if (!fs.existsSync(changelogPath)) {
      continue;
    }

    const content = fs.readFileSync(changelogPath, 'utf8');
    const latestVersion = extractLatestVersionFromChangelog(content);
    if (latestVersion) {
      appVersion = latestVersion;
      break;
    }
  }
} catch {
  // Ignore and keep fallback version.
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  serverExternalPackages: ['better-sqlite3'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },

  // Uncoment to add domain whitelist
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: { not: /\.(css|scss|sass)$/ },
        resourceQuery: { not: /url/ }, // exclude if *.svg?url
        loader: '@svgr/webpack',
        options: {
          dimensions: false,
          titleProp: true,
        },
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
