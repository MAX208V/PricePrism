-- PricePrism D1 数据库 Schema
-- 部署: wrangler d1 execute priceprism-db --file=schema.sql

-- 应用配置表
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,                     -- 包名 (com.example.app)
  name TEXT NOT NULL DEFAULT '',            -- 显示名称
  threshold REAL DEFAULT 6,                -- 降价阈值
  country TEXT DEFAULT 'us',               -- 默认国家
  countries TEXT DEFAULT '["us"]',         -- 监控区域列表 (JSON数组)
  lang TEXT DEFAULT 'en',                  -- 语言
  note TEXT DEFAULT '',                     -- 备注
  monitor_mode TEXT DEFAULT 'threshold',   -- 监控模式: threshold|change
  monitor_iap INTEGER DEFAULT 0,           -- 是否监控内购
  iap_threshold REAL,                      -- 内购阈值
  created_at TEXT,                          -- 创建时间
  updated_at TEXT                           -- 更新时间
);

-- 价格走势记录表（每小时一条）
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,                    -- 包名
  country TEXT NOT NULL DEFAULT 'us',      -- 区域
  price REAL,                              -- 价格
  free INTEGER DEFAULT 0,                  -- 是否免费
  currency TEXT DEFAULT 'USD',             -- 货币
  price_text TEXT DEFAULT '',              -- 显示文本
  recorded_at TEXT NOT NULL,               -- 记录时间
  FOREIGN KEY (app_id) REFERENCES apps(id)
);
CREATE INDEX IF NOT EXISTS idx_price_app ON price_history(app_id, country, recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_time ON price_history(recorded_at);

-- 通知记录表
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,                    -- 包名
  name TEXT DEFAULT '',                     -- 应用名称
  price REAL,                              -- 触发价格
  threshold REAL,                          -- 当时阈值
  type TEXT DEFAULT 'price',               -- 类型: price|iap
  notified INTEGER DEFAULT 1,              -- 是否已通知
  time TEXT NOT NULL,                       -- 通知时间
  FOREIGN KEY (app_id) REFERENCES apps(id)
);
CREATE INDEX IF NOT EXISTS idx_notify_app ON notifications(app_id, time);
CREATE INDEX IF NOT EXISTS idx_notify_time ON notifications(time);
