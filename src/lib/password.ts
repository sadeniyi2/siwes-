import "server-only";
import crypto from "crypto";

// Password hashing with scrypt (built into Node — no extra dependency).
// We store a per-user random salt and the derived hash; verification is
// constant-time.

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  if (!hash || !salt) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return (
      derived.length === stored.length &&
      crypto.timingSafeEqual(derived, stored)
    );
  } catch {
    return false;
  }
}
