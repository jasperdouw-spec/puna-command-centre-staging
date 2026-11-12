-- Run privately only after confirming these columns against current schema.
-- No provider requests, job advancement, credential/identity payload or writes.
START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;
SELECT UTC_TIMESTAMP(3) AS observed_at;
SELECT verified_at,last_success,last_attempt,failure_code,watermark
FROM sales_connection WHERE id=1;
SELECT id,kind,state,start_at,end_at,phase,location_index,pages,records,failure_code,
       started_at,completed_at,(checkpoint_cursor IS NOT NULL) AS has_pending_cursor
FROM sales_runs ORDER BY started_at DESC LIMIT 20;
SELECT COUNT(*) AS unfinished_runs FROM sales_runs WHERE state<>'complete';
SELECT state,reason,COUNT(*) AS orders_count FROM sales_api_orders GROUP BY state,reason;
SELECT COUNT(*) AS unresolved_mappings FROM sales_mappings WHERE product_id IS NULL;
SELECT source_kind,included,MIN(local_date) AS first_date,MAX(local_date) AS last_date,
       COUNT(*) AS fact_count,COUNT(DISTINCT location_key) AS observed_locations
FROM sales_details GROUP BY source_kind,included;
COMMIT;
-- Observed min/max dates/location counts do not prove gap-free historical coverage.
