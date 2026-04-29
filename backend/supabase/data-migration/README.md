# Supabase Data Migration Runbook

This folder contains repeatable scripts for **export**, **import**, and **verification** when moving data from the current PostgreSQL database to Supabase.

## Prerequisites

- `pg_dump` and `psql` installed and available in `PATH`
- Source DB connection URL (legacy PostgreSQL)
- Target DB direct connection URL (Supabase session mode / port 5432)
- Schema + RPC migrations already applied on target (`00001`–`00005`)

## Critical Ordering

- Import data **before** enabling/applying RLS policies for authenticated/anon access.
- Use target direct URL with `postgres`/service-level credentials during import.

## Environment Variables

Set these when running scripts:

- `SOURCE_DATABASE_URL` - source PostgreSQL URL
- `TARGET_DIRECT_URL` - target Supabase direct/session URL
- `MIGRATION_DIR` (optional) - output directory (default: `backend/supabase/data-migration/output`)

## 1) Export

```bash
cd backend
SOURCE_DATABASE_URL='postgresql://...' bash supabase/data-migration/export_data.sh
```

This creates:

- Full backup export: `output/full/export.sql`
- Ordered per-table inserts: `output/tables/NN_TableName.sql`

## 2) Import (FK-safe order)

```bash
cd backend
TARGET_DIRECT_URL='postgresql://...' bash supabase/data-migration/import_data.sh
```

The script imports table dumps in the exact FK dependency order from `table_order.txt`.

## 3) Verify

```bash
cd backend
SOURCE_DATABASE_URL='postgresql://...'
TARGET_DIRECT_URL='postgresql://...'
bash supabase/data-migration/verify_data.sh
```

Verification includes:

- Row-count parity for all 25 tables + 3 junction tables
- FK orphan checks
- Unique-key duplicate checks
- JSONB shape/encoding spot checks
- Enum validity checks

## Notes

- Sequence reset is not required for this schema because primary keys are UUID/TEXT-based, not serial integers.
- If verification fails, do not proceed to production cutover.