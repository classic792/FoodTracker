import { Router } from "express";
import { login, me, logout } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

export default router;
