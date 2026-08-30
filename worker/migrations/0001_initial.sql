PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leadership_workspaces (
  workspace_key TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leadership_term_profiles (
  term_number INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'archived')),
  meeting_date TEXT NOT NULL DEFAULT '',
  starts_on TEXT NOT NULL DEFAULT '',
  ends_on TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leadership_core_roster (
  term_number INTEGER NOT NULL,
  role_key TEXT NOT NULL,
  role_name TEXT NOT NULL,
  member_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (term_number, role_key),
  UNIQUE (term_number, member_id),
  FOREIGN KEY (term_number)
    REFERENCES leadership_term_profiles(term_number)
    ON DELETE CASCADE
);
