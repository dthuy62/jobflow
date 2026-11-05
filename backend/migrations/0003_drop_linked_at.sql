-- Up Migration
-- Firebase now says whether a guest is still anonymous, at merge time. This column could only
-- know once a new token had reached the server.
ALTER TABLE users DROP COLUMN linked_at;

-- Down Migration
ALTER TABLE users ADD COLUMN linked_at timestamptz;
