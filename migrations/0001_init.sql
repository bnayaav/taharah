-- Migration 0001: Initial schema for Taharah app

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  tracker_user_id TEXT NOT NULL UNIQUE,
  partner_user_id TEXT UNIQUE,
  invite_code TEXT UNIQUE,
  invite_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  shared_stains INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tracker_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_couples_invite ON couples(invite_code);
CREATE INDEX IF NOT EXISTS idx_couples_partner ON couples(partner_user_id);

CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  start_onah TEXT NOT NULL,
  hefsek_date TEXT,
  mikveh_date TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cycles_user_date ON cycles(user_id, start_date DESC);

CREATE TABLE IF NOT EXISTS stains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  bg TEXT,
  location TEXT,
  notes TEXT,
  concern_level TEXT,
  verdict_text TEXT,
  ai_analyzed INTEGER NOT NULL DEFAULT 0,
  analysis_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stains_user_date ON stains(user_id, date DESC);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  full_day INTEGER NOT NULL DEFAULT 0,
  or_le INTEGER NOT NULL DEFAULT 0,
  notifications INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
