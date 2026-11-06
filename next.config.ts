import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🟢 WAJIB UNTUK ELECTRON BUILDER
  output: "standalone",

  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  
  devIndicators: false,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;