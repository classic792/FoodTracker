import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import pkg from "@prisma/client";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});
const adapter = new PrismaPg(pool);

export const prisma = new pkg.PrismaClient({
  adapter,
  // Do not log queries/errors that can contain credential data during seeding.
  log: [],
});

export const checkDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL database connected successfully via Prisma");
  } catch (err) {
    console.error("Error connecting to PostgreSQL database.");
    throw err;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
  } finally {
    await pool.end();
  }
};
