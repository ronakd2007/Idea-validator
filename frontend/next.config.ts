import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the floating Next.js dev-tools badge in the bottom-left corner. It
  // never renders in production anyway, but it sat on top of page content
  // during local testing and in screenshots.
  devIndicators: false,
};

export default nextConfig;
