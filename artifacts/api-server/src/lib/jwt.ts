import jwt from "jsonwebtoken";

const rawSecret = process.env.SESSION_SECRET?.trim();
const isProduction = process.env.NODE_ENV === "production";
const secret = rawSecret ?? (isProduction ? "" : "dev-jwt-fallback-secret");

if (!secret) {
  throw new Error("SESSION_SECRET is required in production");
}

export interface JwtPayload {
  userId: number;
  name: string;
  email: string;
  tokenVersion: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}
