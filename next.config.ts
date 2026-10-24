import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.SCMS_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
};

export default nextConfig;
