import jwt from "jsonwebtoken";

const secret = process.env.SESSION_SECRET ?? "dev-jwt-fallback-secret";

export interface JwtPayload {
  userId: number;
  name: string;
  email: string;
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
