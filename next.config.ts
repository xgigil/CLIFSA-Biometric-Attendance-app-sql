import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.56.1"],
  serverExternalPackages: ["mysql2", "bcryptjs"],
};

export default nextConfig;
