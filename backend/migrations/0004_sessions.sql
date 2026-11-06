-- Up Migration
-- The backend owns guests and sessions; Firebase only signs members in (spec, 2026-11-06).
-- A guest has no subject. UNIQUE still holds for members, because NULLs never clash.
ALTER TABLE users ALTER COLUMN auth_subject DROP NOT NULL;

-- One refresh token per session, not rotated. Only its SHA-256 is stored.
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_hash bytea NOT NULL UNIQUE CHECK (octet_length(refresh_token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text CHECK (revoked_reason IN ('logout', 'merged')),
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX sessions_user_id ON sessions (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO jobflow_app;

-- Down Migration
DROP TABLE sessions;

-- Fails while a guest exists, which is right: a guest has no subject to go back to.
ALTER TABLE users ALTER COLUMN auth_subject SET NOT NULL;
