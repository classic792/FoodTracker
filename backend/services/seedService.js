import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../config/db.js";

const staff = [
  {
    fullName: "Alex Morgan",
    email: "alex@foodtracker.example",
    password: "Alex-Dev-Only-2026!",
    isActive: true,
  },
  {
    fullName: "Sam Rivera",
    email: "sam@foodtracker.example",
    password: "Sam-Dev-Only-2026!",
    isActive: true,
  },
  {
    fullName: "Inactive Staff",
    email: "inactive@foodtracker.example",
    password: "Inactive-Dev-Only-2026!",
    isActive: false,
  },
];

export const seedStaff = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development staff seeding is disabled in production.");
  }
  for (const { password, ...user } of staff) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(password, 12);
    // skipDuplicates also protects existing accounts if two seed processes race.
    await prisma.user.createMany({
      data: [{ ...user, id: randomUUID(), passwordHash }],
      skipDuplicates: true,
    });
  }
};
