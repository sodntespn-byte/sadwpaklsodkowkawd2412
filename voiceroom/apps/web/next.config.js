/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@voiceroom/shared'],
  output: 'standalone',
};

module.exports = nextConfig;
