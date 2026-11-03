import "dotenv/config";
import { defineConfig } from "prisma/config";

// Schema pushes use the DIRECT (non-pooled) Neon connection; the app itself
// uses the pooled DATABASE_URL (lib/db/index.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
