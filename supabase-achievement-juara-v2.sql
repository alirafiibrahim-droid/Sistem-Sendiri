-- ============================================================================
-- A8: Achievement Juara v2 - Juara pada level prestasi (tipe ORGANIZATION)
-- Jalankan SETELAH supabase-achievement-juara.sql
-- Execute this in Supabase Dashboard SQL Editor
-- ============================================================================

-- 1. Tambah kolom juara pada tabel achievements
--    (juara prestasi ORGANIZATION disimpan di level prestasi, bukan per anggota)
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS juara public.achievement_juara;

-- 2. Buat kolom juara peserta menjadi nullable
--    (untuk prestasi ORGANIZATION, peserta tidak membawa juara masing-masing)
ALTER TABLE public.achievement_participants
  ALTER COLUMN juara DROP NOT NULL;
