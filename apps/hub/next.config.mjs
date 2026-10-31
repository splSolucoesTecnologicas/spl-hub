/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/hub',
  transpilePackages: ['@spl/contracts'],
  output: 'standalone',
};

export default nextConfig;
