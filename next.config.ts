import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  poweredByHeader: false,
};

export default nextConfig;
