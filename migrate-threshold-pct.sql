-- 百分比阈值
ALTER TABLE apps ADD COLUMN threshold_type TEXT DEFAULT 'amount';
ALTER TABLE apps ADD COLUMN threshold_pct REAL;
