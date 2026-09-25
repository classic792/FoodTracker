import { AUTH_COOKIE } from "../config/auth.js";
import { authenticate } from "../services/authService.js";
import { readCookie } from "../utils/cookies.js";

export const requireAuth = async (req, res, next) => {
  try {
    req.user = await authenticate(readCookie(req.headers.cookie, AUTH_COOKIE));
    next();
  } catch (error) {
    next(error);
  }
};
