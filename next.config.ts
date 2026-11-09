import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.56.1", "10.10.30.162"],
  serverExternalPackages: ["mysql2", "bcryptjs"],
};

export default nextConfig;
