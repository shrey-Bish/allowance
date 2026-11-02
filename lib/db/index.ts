// Single Prisma client for the whole app. The driver adapter is chosen from
// DATABASE_URL so the same code runs on SQLite locally and Postgres when hosted.
import { PrismaClient } from "./generated/client";

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };
