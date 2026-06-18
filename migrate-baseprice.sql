-- 添加基准价格字段
ALTER TABLE apps ADD COLUMN base_price REAL;
ALTER TABLE apps ADD COLUMN base_currency TEXT DEFAULT 'USD';
