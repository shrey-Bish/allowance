import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything in Allowance is request-time data; see docs/DECISIONS.md.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-better-sqlite3", "better-sqlite3", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
