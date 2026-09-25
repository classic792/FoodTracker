import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { ACCESS_TOKEN_SECONDS, getAuthSettings } from "../config/auth.js";
import { httpError, unauthorized } from "../utils/errors.js";

const DUMMY_HASH =
  "$2b$12$wKBJIN6Y8inHcLDFcLXYb.cDpPknHRz1R/8XzduIfoMuUkMBZOBs2";
const identitySelect = {
  id: true,
  fullName: true,
  email: true,
  isActive: true,
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...identitySelect, passwordHash: true },
  });
  const matches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  if (!user || !matches || !user.isActive) {
    throw httpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  const token = jwt.sign({}, getAuthSettings().secret, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: ACCESS_TOKEN_SECONDS,
  });
  return {
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email },
  };
};

export const authenticate = async (token) => {
  if (!token) throw unauthorized();
  const { secret } = getAuthSettings();
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    )
      throw unauthorized();
    throw error;
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      payload.sub,
    ) ||
    !Number.isFinite(payload.exp)
  )
    throw unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: identitySelect,
  });
  if (!user?.isActive) throw unauthorized();
  return user;
};
