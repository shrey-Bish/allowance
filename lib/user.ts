// Single demo user (spec §4: no account system). Everything is scoped to them.
import { prisma } from "@/lib/db";
import { SEED_USER } from "@/lib/catalog/seed-data";

export async function getDemoUser() {
  const user = await prisma.user.findUnique({ where: { email: SEED_USER.email }, include: { policy: true } });
  if (!user) throw new Error("Demo user missing — run `pnpm db:seed`");
  return user;
}
