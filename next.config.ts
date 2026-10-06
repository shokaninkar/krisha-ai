import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.krisha.kz" },
      { protocol: "https", hostname: "**.kcdn.online" },
    ],
  },
};

export default nextConfig;
