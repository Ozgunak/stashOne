// Prisma client singleton.
//
// In dev, Next.js hot-reload would create a new PrismaClient on every save,
// which exhausts the database connection pool. Storing the client on the
// global object survives hot-reloads. In production, modules aren't hot-
// reloaded so the global trick is harmless.
//
// Prisma 7 requires a "driver adapter" — the client no longer ships its own
// database driver. We use the Postgres adapter (`pg` under the hood).

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
