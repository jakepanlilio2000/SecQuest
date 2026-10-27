import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db, first, type Database } from "./db";
import type { User } from "./types";
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = await derive(password, salt);
  const old = Buffer.from(hex, "hex");
  return old.length === key.length && timingSafeEqual(old, key);
}
export async function createUser(
  email: string,
  name: string,
  password: string,
  database = db(),
) {
  const u = {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    password_hash: await hashPassword(password),
    role: "learner",
    settings: JSON.stringify({
      exam: "SY0-801",
      dailyGoal: 20,
      theme: "dark",
      onboarded: false,
    }),
    created_at: new Date().toISOString(),
  };
  await database.transaction((tx) =>
    tx.run(
      "INSERT INTO users(id,email,name,password_hash,role,settings,created_at) VALUES (?,?,?,?,?,?,?)",
      Object.values(u),
    ),
  );
  return u;
}
export async function createAuthSession(userId: string, database = db()) {
  const token = randomBytes(32).toString("hex");
  await database.transaction((tx) =>
    tx.run(
      "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)",
      [
        hashToken(token),
        userId,
        new Date(Date.now() + 30 * 86400000).toISOString(),
      ],
    ),
  );
  return token;
}
export async function getUser(request: Request, database = db()) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sq_session="))
    ?.slice(11);
  if (!token) return undefined;
  return first<User>(
    database,
    "SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
    [hashToken(token), new Date().toISOString()],
  );
}
export const cookie = (token: string, maxAge = 30 * 86400) =>
  `sq_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
export async function limit(
  key: string,
  max: number,
  windowSeconds: number,
  database = db(),
) {
  return database.transaction(async (tx) => {
    const now = new Date();
    await tx.run("DELETE FROM rate_limits WHERE expires_at<?", [
      now.toISOString(),
    ]);
    const row = await first<{ hits: number }>(
      tx,
      "SELECT hits FROM rate_limits WHERE key=?",
      [key],
    );
    if (row && row.hits >= max) return false;
    await tx.run(
      "INSERT INTO rate_limits(key,hits,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET hits=rate_limits.hits+1",
      [key, 1, new Date(now.getTime() + windowSeconds * 1000).toISOString()],
    );
    return true;
  });
}
export async function lockUser(tx: Database, id: string) {
  await tx.run("UPDATE users SET name=name WHERE id=?", [id]);
}
export function safeUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    settings: JSON.parse(u.settings),
    createdAt: u.created_at,
  };
}
