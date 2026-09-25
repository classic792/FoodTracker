import { loginSchema } from "../validators/authValidators.js";
import * as authService from "../services/authService.js";
import {
  ACCESS_TOKEN_SECONDS,
  AUTH_COOKIE,
  cookieOptions,
} from "../config/auth.js";
import { httpError } from "../utils/errors.js";

export const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      const field = error.details[0].path[0];
      const message =
        field === "email"
          ? "A valid email is required (maximum 254 characters)."
          : field === "password"
            ? "Password is required and must not exceed 72 UTF-8 bytes."
            : "Provide only email and password.";
      throw httpError(400, "VALIDATION_ERROR", message);
    }
    const result = await authService.login(value);
    res.cookie(AUTH_COOKIE, result.token, {
      ...cookieOptions(),
      maxAge: ACCESS_TOKEN_SECONDS * 1000,
    });
    res.status(200).json({
      ...result.user,
      accessToken: result.token,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_SECONDS,
    });
  } catch (error) {
    next(error);
  }
};

export const me = (req, res) => res.status(200).json(req.user);

export const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
  res.status(200).json({ message: "Logged out." });
};
