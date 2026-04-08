'use strict';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: {
    domains: ['example.com', 'another-example.com'],
  },
  // Add any other Next.js configurations you may need
};

module.exports = nextConfig;
