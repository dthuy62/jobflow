-- Up Migration
-- linked_at: when this user first finished a sign-in with a real account. An anonymous token
-- issued before Firebase linked the account stays valid for up to an hour, and must not merge it.
-- merged_into: where a closed guest's data went, so a retry gets the same answer.
ALTER TABLE users
  ADD COLUMN linked_at timestamptz,
  ADD COLUMN merged_into uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE devices (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  fcm_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, installation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO jobflow_app;

-- Down Migration
DROP TABLE devices;

ALTER TABLE users
  DROP COLUMN merged_into,
  DROP COLUMN linked_at;
