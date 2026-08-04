-- ============================================================================
-- SIORG - FIX: RELASI FK INVENTORI KE PUBLIC.PROFILES
-- Kolom pengguna pada tabel inventori (created_by/borrower_id/approved_by/
-- reported_by) menunjuk ke auth.users, sehingga PostgREST tidak dapat
-- meng-embed tabel "profiles" dan query SELECT "*...,profiles(...)" gagal
-- (PGRST200 -> 400). Akibatnya tab Peminjaman, Kerusakan, dan Penghapusan
-- pada detail barang selalu kosong.
--
-- Perbaikan: re-point FK tersebut ke public.profiles (profiles.id == auth
-- user id), konsisten dengan modul lain (achievements, dll).
-- Jalankan seluruh SQL ini di Supabase SQL Editor (idempotent).
-- ============================================================================

-- 1. Lepas FK lama yang menunjuk ke auth.users (jika ada)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tbl.relname AS tbl_name, col.attname AS col_name, c.conname AS con_name
        FROM pg_constraint c
        JOIN pg_namespace ns ON ns.oid = c.connamespace
        JOIN pg_class tbl ON tbl.oid = c.conrelid
        JOIN pg_attribute col ON col.attrelid = c.conrelid AND col.attnum = ANY(c.conkey)
        JOIN pg_class conf ON conf.oid = c.confrelid
        JOIN pg_namespace fns ON fns.oid = conf.relnamespace
        WHERE ns.nspname = 'public'
          AND c.contype = 'f'
          AND fns.nspname = 'auth'
          AND conf.relname = 'users'
          AND tbl.relname IN ('inventory_disposals', 'inventory_loans', 'inventory_damage_logs', 'inventory_purchases')
          AND col.attname IN ('created_by', 'borrower_id', 'approved_by', 'reported_by')
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl_name, r.con_name);
        RAISE NOTICE 'Dropped FK % on %.%', r.con_name, r.tbl_name, r.col_name;
    END LOOP;
END $$;

-- 2. Re-point FK ke public.profiles (idempotent)
ALTER TABLE public.inventory_disposals
    DROP CONSTRAINT IF EXISTS inventory_disposals_created_by_fkey;
ALTER TABLE public.inventory_disposals
    ADD CONSTRAINT inventory_disposals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_loans
    DROP CONSTRAINT IF EXISTS inventory_loans_borrower_id_fkey;
ALTER TABLE public.inventory_loans
    ADD CONSTRAINT inventory_loans_borrower_id_fkey
    FOREIGN KEY (borrower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_loans
    DROP CONSTRAINT IF EXISTS inventory_loans_approved_by_fkey;
ALTER TABLE public.inventory_loans
    ADD CONSTRAINT inventory_loans_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_damage_logs
    DROP CONSTRAINT IF EXISTS inventory_damage_logs_reported_by_fkey;
ALTER TABLE public.inventory_damage_logs
    ADD CONSTRAINT inventory_damage_logs_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_purchases
    DROP CONSTRAINT IF EXISTS inventory_purchases_created_by_fkey;
ALTER TABLE public.inventory_purchases
    ADD CONSTRAINT inventory_purchases_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
