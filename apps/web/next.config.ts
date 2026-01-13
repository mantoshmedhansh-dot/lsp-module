import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cjdquick/ui", "@cjdquick/database", "@cjdquick/types"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
