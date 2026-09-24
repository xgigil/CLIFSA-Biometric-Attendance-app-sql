import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

// Manually load environment variables from .env.local for tests
try {
  const envPath = path.resolve(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split(/\r?\n/).forEach((line) => {
      // Ignore comments and empty lines
      if (line.trim().startsWith("#") || !line.includes("=")) return;
      const [key, ...valueParts] = line.split("=");
      const val = valueParts.join("=").trim();
      const cleanedVal = val.replace(/^['"]|['"]$/g, ""); // strip wrapping quotes
      process.env[key.trim()] = cleanedVal;
    });
  }
} catch (error) {
  console.error("Failed to load .env.local in vitest.config.ts:", error);
}

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});


