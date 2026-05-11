import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /** Đảm bảo binary native `sharp` được copy đúng trong `.next/standalone` (upload). */
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
