import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cjdquick/ui", "@cjdquick/database", "@cjdquick/types"],
};

export default nextConfig;
