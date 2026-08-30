CREATE TABLE IF NOT EXISTS leadership_member_directory (
  member_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  profession TEXT NOT NULL DEFAULT '',
  expiry_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  source_updated_at TEXT NOT NULL DEFAULT '',
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leadership_source_cache_meta (
  cache_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
