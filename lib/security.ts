
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-mobcash-secret-change-me");

export async function hashPassword(password: string) {
  return bcrypt.hash(String(password), 10);
}

export async function verifyPassword(raw: string, stored: string) {
  const value = String(stored || "");
  if (!value) return false;
  if (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$")) {
    return bcrypt.compare(String(raw), value);
  }
  return String(raw) === value;
}

export async function signSessionToken(payload: {
  id: string;
  role: string;
  email: string;
  username?: string;
  /** `User.applicationStatus` — middleware uses this when `mobcash_user` is missing (any role). */
  applicationStatus?: string;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}
