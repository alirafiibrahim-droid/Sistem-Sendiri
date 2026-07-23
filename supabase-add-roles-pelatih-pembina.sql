-- ============================================================================
-- MIGRATION: Tambah Role PELATIH & PEMBINA ke enum user_role
-- Target: Supabase PostgreSQL
-- ============================================================================

-- Tambah nilai baru ke enum user_role
-- PostgreSQL tidak support DROP VALUE dari enum, jadi kita pakai ALTER TYPE ADD VALUE
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'KETUA_UMUM' BEFORE 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'WAKIL_KETUA' BEFORE 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SEKRETARIS' AFTER 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'BENDAHARA' AFTER 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PELATIH' AFTER 'KABID';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PEMBINA' AFTER 'KABID';

-- Catatan: Urutan ENUM di PostgreSQL menentukan urutan sorting.
-- Jika ALTER TYPE BEFORE/AFTER tidak didukung (PG < 12), gunakan cara berikut:
-- 1. Buat enum type baru dengan urutan lengkap
-- 2. Alter kolom role untuk pakai type baru
-- 3. Drop type lama
-- 4. Rename type baru ke nama semula

-- Cara alternatif (jika ALTER TYPE ... BEFORE/AFTER tidak work):
-- CREATE TYPE public.user_role_new AS ENUM (
--   'ADMIN', 'KETUA_UMUM', 'WAKIL_KETUA', 'PENGURUS_INTI',
--   'SEKRETARIS', 'BENDAHARA', 'KABID', 'PELATIH', 'PEMBINA', 'ANGGOTA'
-- );
-- ALTER TABLE public.profiles ALTER COLUMN role TYPE public.user_role_new USING role::text::public.user_role_new;
-- DROP TYPE public.user_role;
-- ALTER TYPE public.user_role_new RENAME TO user_role;
