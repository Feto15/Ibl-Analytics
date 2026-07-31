import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  } catch {
    // Ignore in non-Cloudflare environments
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
