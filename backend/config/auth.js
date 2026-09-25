import "dotenv/config";

export const ACCESS_TOKEN_SECONDS = 30 * 60;
export const AUTH_COOKIE = "foodtracker_access_token";

export const getAuthSettings = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret?.trim()) throw new Error("JWT_ACCESS_SECRET is required");
  const production = process.env.NODE_ENV === "production";
  const origin =
    process.env.CLIENT_ORIGIN?.trim() ||
    (production ? undefined : "http://localhost:5173");
  if (!origin) throw new Error("CLIENT_ORIGIN is required in production");
  const parsed = new URL(origin);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== origin ||
    (production && parsed.protocol !== "https:")
  ) {
    throw new Error(
      "CLIENT_ORIGIN must be an exact HTTP(S) origin, using HTTPS in production",
    );
  }
  return { secret, origin };
};

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});
