-- Up Migration
-- The backend owns guests and sessions; Firebase only signs members in (spec, 2026-11-06).
-- A guest has no subject. UNIQUE still holds for members, because NULLs never clash.
ALTER TABLE users ALTER COLUMN auth_subject DROP NOT NULL;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text CHECK (revoked_reason IN ('logout', 'merged', 'reuse')),
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX sessions_user_id ON sessions (user_id);

-- Only the SHA-256 of a refresh token is stored. A used token stays, so a second use of it is
-- seen. SET NULL, so a later clean-up of old tokens never takes their newer descendants along.
CREATE TABLE refresh_tokens (
  token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  parent_hash bytea REFERENCES refresh_tokens (token_hash) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX refresh_tokens_session_id ON refresh_tokens (session_id);
CREATE INDEX refresh_tokens_parent_hash ON refresh_tokens (parent_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, refresh_tokens TO jobflow_app;

-- Down Migration
DROP TABLE refresh_tokens;
DROP TABLE sessions;

-- Fails while a guest exists, which is right: a guest has no subject to go back to.
ALTER TABLE users ALTER COLUMN auth_subject SET NOT NULL;
