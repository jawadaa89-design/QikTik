import { createHash, randomBytes, timingSafeEqual } from "crypto";

export { TABLE_LOCK_MS } from "@/lib/table-lock";

/** Store format: saltHex:hashHex */
export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${salt}:${passcode}`).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = createHash("sha256").update(`${salt}:${passcode}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
}
