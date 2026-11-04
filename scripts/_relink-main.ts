import { PrismaClient } from "../lib/db/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
async function main() {
  const url = readFileSync(process.env.HOME + "/.allowance-neon-main-pooled", "utf8").trim();
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await p.user.update({ where: { email: "demo@allowance.local" }, data: { paypalVaultId: "49v74238051021634", paypalPayerEmail: "sb-tm78g53689249@personal.example.com" } });
  console.log("relinked"); await p.$disconnect();
}
main();
