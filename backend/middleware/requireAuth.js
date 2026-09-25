import { AUTH_COOKIE } from "../config/auth.js";
import { authenticate } from "../services/authService.js";
import { readCookie } from "../utils/cookies.js";
import { unauthorized } from "../utils/errors.js";

const readAccessToken = (req) => {
  const authorization = req.headers.authorization;
  if (authorization !== undefined) {
    const match =
      typeof authorization === "string"
        ? /^Bearer[ \t]+([^\s,]+)[ \t]*$/i.exec(authorization)
        : null;
    if (!match) throw unauthorized();
    return match[1];
  }
  return readCookie(req.headers.cookie, AUTH_COOKIE);
};

export const requireAuth = async (req, res, next) => {
  try {
    req.user = await authenticate(readAccessToken(req));
    next();
  } catch (error) {
    next(error);
  }
};
