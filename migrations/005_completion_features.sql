CREATE TABLE IF NOT EXISTS email_verifications (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, verified_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_verification_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS verification_owner ON email_verification_tokens(user_id);
CREATE TABLE IF NOT EXISTS notebook_flashcards (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, entry_id TEXT NOT NULL REFERENCES notebook_entries(id) ON DELETE CASCADE, content_hash TEXT NOT NULL, card_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(user_id,entry_id,content_hash));
CREATE TABLE IF NOT EXISTS leaderboard_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, public_id TEXT NOT NULL UNIQUE, alias TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS review_policies (version TEXT PRIMARY KEY, data TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL);
