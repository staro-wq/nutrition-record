import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Turbopack is enabled by default in Next.js 16, but next-pwa only provides a Webpack plugin.
  // Adding an empty configuration silences the error.
  turbopack: {},
};

export default withPWA(nextConfig);
