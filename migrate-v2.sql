-- D1 数据库迁移 (v1 → v2: 添加最新状态字段到 apps 表)
-- 运行: wrangler d1 execute priceprism-db --file=migrate-v2.sql

ALTER TABLE apps ADD COLUMN last_price REAL;
ALTER TABLE apps ADD COLUMN last_free INTEGER DEFAULT 0;
ALTER TABLE apps ADD COLUMN last_currency TEXT DEFAULT 'USD';
ALTER TABLE apps ADD COLUMN last_price_text TEXT DEFAULT '';
ALTER TABLE apps ADD COLUMN last_icon TEXT;
ALTER TABLE apps ADD COLUMN last_score REAL;
ALTER TABLE apps ADD COLUMN last_score_text TEXT DEFAULT '';
ALTER TABLE apps ADD COLUMN last_installs TEXT;
ALTER TABLE apps ADD COLUMN last_developer TEXT;
ALTER TABLE apps ADD COLUMN last_offers_iap INTEGER DEFAULT 0;
ALTER TABLE apps ADD COLUMN last_iap_range TEXT;
ALTER TABLE apps ADD COLUMN last_contains_ads INTEGER DEFAULT 0;
ALTER TABLE apps ADD COLUMN last_prices_by_country TEXT DEFAULT '{}';
ALTER TABLE apps ADD COLUMN last_notified_price REAL;
ALTER TABLE apps ADD COLUMN last_notified_at TEXT;
ALTER TABLE apps ADD COLUMN last_iap_notified_price REAL;
ALTER TABLE apps ADD COLUMN last_iap_notified_at TEXT;
ALTER TABLE apps ADD COLUMN last_checked_at TEXT;
