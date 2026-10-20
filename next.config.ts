import type { NextConfig } from "next";
import { remoteImageHosts } from "./src/lib/remote-image-hosts";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: remoteImageHosts.map(({ hostname, pathname }) => ({
      protocol: "https" as const,
      hostname,
      pathname,
    })),
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
