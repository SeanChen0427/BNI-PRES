CREATE TABLE IF NOT EXISTS leadership_core_roster_bootstrap (
  term_number INTEGER NOT NULL,
  role_key TEXT NOT NULL,
  role_name TEXT NOT NULL,
  member_name_hmac TEXT NOT NULL,
  PRIMARY KEY (term_number, role_key),
  UNIQUE (term_number, member_name_hmac),
  FOREIGN KEY (term_number)
    REFERENCES leadership_term_profiles(term_number)
    ON DELETE CASCADE
);
