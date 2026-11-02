import "dotenv/config";
import { prisma } from "../lib/db";
import { seedDatabase } from "../lib/catalog/seed";

seedDatabase(prisma)
  .then((summary) => {
    console.log("seeded:", summary);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
