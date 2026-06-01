import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright uses native binaries and cannot be bundled by webpack.
  // Without this, the route module fails to load and returns HTML 500 before
  // any try-catch in the route handler can run.
  serverExternalPackages: ['playwright', 'playwright-core', 'playwright-extra'],
};

export default nextConfig;
