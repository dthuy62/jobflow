-- Up Migration
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Grants live in migrations because default privileges are per database, so a role
-- script would not reach test or deployed databases.
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO jobflow_app;

-- Down Migration
DROP TABLE users;
