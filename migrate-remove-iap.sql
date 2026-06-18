-- 移除内购监控相关列
ALTER TABLE apps DROP COLUMN monitor_iap;
ALTER TABLE apps DROP COLUMN iap_threshold;
ALTER TABLE apps DROP COLUMN last_iap_notified_price;
ALTER TABLE apps DROP COLUMN last_iap_notified_at;
ALTER TABLE apps DROP COLUMN last_offers_iap;
ALTER TABLE apps DROP COLUMN last_iap_range;
