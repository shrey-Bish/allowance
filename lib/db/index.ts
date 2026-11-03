// Single Prisma client for the whole app. Neon Postgres via node-postgres;
// the POOLED connection string (DATABASE_URL) is right for a web app.
import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — run `neon checkout dev` or copy .env.example");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };
