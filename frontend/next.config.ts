import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = (
      process.env.VHQ_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    agentFeedback: true,
    proxyTimeout: 120000,
  },
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
