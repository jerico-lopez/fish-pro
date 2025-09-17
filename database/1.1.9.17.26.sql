ALTER TABLE daily_reports 
DROP COLUMN freight_type,
DROP COLUMN freight_amount,
DROP COLUMN cost;

ALTER TABLE daily_reports 
ADD COLUMN air_cargo DECIMAL(10,2) DEFAULT 0 AFTER cost_per_box,