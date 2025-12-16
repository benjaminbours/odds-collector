import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
  },
};

// Initialize OpenNext for local development with Cloudflare bindings
// Use remote: true to connect to actual Cloudflare R2/D1 resources
initOpenNextCloudflareForDev();

export default nextConfig;
