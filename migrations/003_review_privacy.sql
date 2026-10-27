CREATE TABLE content_reviews_new (id TEXT PRIMARY KEY, question_id TEXT NOT NULL, revision INTEGER NOT NULL, reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL, decision TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(question_id,revision) REFERENCES question_revisions(question_id,revision));
INSERT INTO content_reviews_new(id,question_id,revision,reviewer_id,decision,note,created_at) SELECT id,question_id,revision,reviewer_id,decision,note,created_at FROM content_reviews;
DROP TABLE content_reviews;
ALTER TABLE content_reviews_new RENAME TO content_reviews;
