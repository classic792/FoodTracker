import "dotenv/config";
import { disconnectDatabase } from "../config/db.js";
import { seedStaff } from "../services/seedService.js";

const main = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Production seed blocked");
    }
    await seedStaff();
    console.log(
      "Development staff seed completed; existing accounts were preserved.",
    );
  } catch {
    console.error(
      process.env.NODE_ENV === "production"
        ? "Development staff seeding is disabled in production."
        : "Staff seed failed. Check the database connection and applied migrations.",
    );
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDatabase();
    } catch {
      console.error("Database cleanup failed.");
      process.exitCode = 1;
    }
  }
};

await main();
