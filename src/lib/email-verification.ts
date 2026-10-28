import { randomBytes } from "node:crypto";
import { db, first, type Database } from "./db";
import { hashToken, lockUser } from "./auth";
import { AppError } from "./errors";
export async function verificationStatus(user: string, database = db()) {
  const row = await first<{ verified_at: string }>(
    database,
    "SELECT verified_at FROM email_verifications WHERE user_id=?",
    [user],
  );
  return {
    verifiedAt: row?.verified_at ?? null,
    deliveryConfigured: !!process.env.SMTP_URL,
  };
}
// Tokens are only returned to the mail-delivery boundary, never to a production API response.
export async function issueVerification(
  user: string,
  database = db(),
  now = new Date(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    if (
      await first(
        tx,
        "SELECT user_id FROM email_verifications WHERE user_id=?",
        [user],
      )
    )
      throw new AppError("This address is already verified.", 409);
    const recent = await first<{ created_at: string }>(
      tx,
      "SELECT created_at FROM email_verification_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
      [user],
    );
    if (recent && now.getTime() - Date.parse(recent.created_at) < 60000)
      throw new AppError(
        "Wait a minute before requesting another verification link.",
        429,
      );
    const token = randomBytes(32).toString("hex");
    await tx.run("DELETE FROM email_verification_tokens WHERE user_id=?", [
      user,
    ]);
    await tx.run(
      "INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)",
      [
        hashToken(token),
        user,
        new Date(now.getTime() + 86400000).toISOString(),
        now.toISOString(),
      ],
    );
    return token;
  });
}
export async function consumeVerification(
  token: string,
  database: Database = db(),
  now = new Date(),
) {
  return database.transaction(async (tx) => {
    const row = await first<{ user_id: string }>(
      tx,
      "SELECT user_id FROM email_verification_tokens WHERE token_hash=? AND expires_at>?",
      [hashToken(token), now.toISOString()],
    );
    if (!row) throw new AppError("Verification link is invalid or expired.");
    await lockUser(tx, row.user_id);
    const available = await first(
      tx,
      "SELECT token_hash FROM email_verification_tokens WHERE token_hash=? AND expires_at>?",
      [hashToken(token), now.toISOString()],
    );
    if (!available)
      throw new AppError("Verification link is invalid or expired.");
    await tx.run(
      "INSERT INTO email_verifications(user_id,verified_at) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING",
      [row.user_id, now.toISOString()],
    );
    await tx.run("DELETE FROM email_verification_tokens WHERE user_id=?", [
      row.user_id,
    ]);
    return { verified: true };
  });
}
