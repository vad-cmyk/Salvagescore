import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core', 'playwright-extra'],
  // playwright-core/lib/coreBundle.js does a synchronous require('./browsers.json')
  // at module load time. Vercel's file tracer misses this JSON file, causing a
  // "Cannot find module .../browsers.json" crash before any request handler runs.
  outputFileTracingIncludes: {
    '/api/analyze': ['./node_modules/playwright-core/**/*'],
    '/api/test-import': ['./node_modules/playwright-core/**/*'],
  },
};

export default nextConfig;
