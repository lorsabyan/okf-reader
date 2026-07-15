/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // Client bundles only ever see NEXT_PUBLIC_ vars inlined at build time, so
  // mirror NEXT_BASE_PATH into one here — a single source of truth for both
  // SSR (basePath above) and client components (src/lib/paths.ts).
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_BASE_PATH ?? '',
  },
};

export default nextConfig;
