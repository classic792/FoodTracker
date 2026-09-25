import express from "express";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { prisma, checkDatabaseConnection } from "./config/db.js";
import { getAuthSettings } from "./config/auth.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import storageLocationRoutes from "./routes/storageLocationRoutes.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { httpError } from "./utils/errors.js";

const { origin } = getAuthSettings();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(
  ["/api/auth", "/api/products", "/api/storage-locations"],
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
);
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== undefined &&
    req.headers.origin !== origin
  ) {
    return next(
      httpError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed."),
    );
  }
  next();
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(
      httpError(
        429,
        "RATE_LIMITED",
        "Too many login attempts. Try again later.",
      ),
    ),
});
app.use("/api/auth/login", (req, res, next) =>
  req.method === "POST" ? loginLimiter(req, res, next) : next(),
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/products", requireAuth, productRoutes);
app.use("/api/storage-locations", requireAuth, storageLocationRoutes);

app.use((req, res, next) =>
  next(httpError(404, "NOT_FOUND", "Endpoint not found.")),
);
app.use(errorHandler);

checkDatabaseConnection()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`App is running on port ${PORT}`);
    });
    server.on("error", (err) => {
      if (err.code === "EACCES") {
        console.error(
          "Port is reserved by Windows. Please set a different PORT in backend/.env.",
        );
      } else {
        console.error("Server failed to listen:", err.code);
      }
    });
  })
  .catch(() => {
    console.error("Failed to start the server: database connection failed.");
    process.exit(1);
  });
