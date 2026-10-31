/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/hub',
  transpilePackages: ['@spl/contracts'],
  output: 'standalone',
  webpack: (config) => {
    config.resolve.extensionAlias = { ...(config.resolve.extensionAlias ?? {}), '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default nextConfig;
