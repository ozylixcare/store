-- Read-only performance metadata; no customer rows, credentials or query literals.
-- Run against a verified staging copy of the CURRENT store database first.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT relname AS table_name, n_live_tup AS estimated_rows,
       seq_scan, seq_tup_read, idx_scan, n_tup_ins, n_tup_upd,
       n_tup_del, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read DESC
LIMIT 25;

SELECT s.relname AS table_name, s.indexrelname AS index_name,
       s.idx_scan, pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
       i.indisunique, i.indisprimary, i.indisvalid,
       pg_get_indexdef(s.indexrelid) AS definition
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
ORDER BY pg_relation_size(s.indexrelid) DESC
LIMIT 100;

SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
COMMIT;
-- Low scan counts since the last stats reset do NOT prove an index is unused.
-- Never drop uniqueness/primary-key/constraint indexes on this evidence alone.
