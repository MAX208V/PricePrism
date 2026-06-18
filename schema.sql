-- PricePrism D1 数据库 Schema (v2 — D1全量)
-- 部署: wrangler d1 execute priceprism-db --file=schema.sql

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  threshold REAL DEFAULT 6,
  country TEXT DEFAULT 'us',
  countries TEXT DEFAULT '["us"]',
  lang TEXT DEFAULT 'en',
  note TEXT DEFAULT '',
  monitor_mode TEXT DEFAULT 'threshold',
  monitor_iap INTEGER DEFAULT 0,
  iap_threshold REAL,
  created_at TEXT,
  updated_at TEXT,
  base_price REAL,
  base_currency TEXT DEFAULT 'USD',
  threshold_type TEXT DEFAULT 'amount',
  threshold_pct REAL,
  last_price REAL,
  last_free INTEGER DEFAULT 0,
  last_currency TEXT DEFAULT 'USD',
  last_price_text TEXT DEFAULT '',
  last_icon TEXT,
  last_score REAL,
  last_score_text TEXT DEFAULT '',
  last_installs TEXT,
  last_developer TEXT,
  last_offers_iap INTEGER DEFAULT 0,
  last_iap_range TEXT,
  last_contains_ads INTEGER DEFAULT 0,
  last_prices_by_country TEXT DEFAULT '{}',
  last_notified_price REAL,
  last_notified_at TEXT,
  last_iap_notified_price REAL,
  last_iap_notified_at TEXT,
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'us',
  price REAL,
  free INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  price_text TEXT DEFAULT '',
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (app_id) REFERENCES apps(id)
);
CREATE INDEX IF NOT EXISTS idx_price_app ON price_history(app_id, country, recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_time ON price_history(recorded_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  name TEXT DEFAULT '',
  price REAL,
  threshold REAL,
  type TEXT DEFAULT 'price',
  notified INTEGER DEFAULT 1,
  time TEXT NOT NULL,
  FOREIGN KEY (app_id) REFERENCES apps(id)
);
CREATE INDEX IF NOT EXISTS idx_notify_app ON notifications(app_id, time);
CREATE INDEX IF NOT EXISTS idx_notify_time ON notifications(time);
