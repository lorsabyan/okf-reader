/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // @okf/core is an unbuilt workspace package (exports point at TS source);
  // tell Next to run it through its own transpiler like app code.
  transpilePackages: ['@okf/core'],
};

export default nextConfig;
