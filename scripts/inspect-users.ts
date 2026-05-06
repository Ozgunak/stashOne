// Throwaway: dump all users from the database. Run with `pnpm exec tsx scripts/inspect-users.ts`.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import "dotenv/config";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const users = await prisma.user.findMany();
  console.log("Users in DB:", users);
  await prisma.$disconnect();
}

main();
