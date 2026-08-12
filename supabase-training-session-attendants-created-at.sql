-- ============================================================================
-- MIGRASI: Kolom created_at pada training_session_attendants
--
-- Tabel training_session_attendants (A3) belum memiliki kolom created_at,
-- tidak seperti program_session_attendants / project_session_attendants.
-- Kolom ini dibutuhkan untuk mencatat & mengurutkan jam kehadiran pada
-- riwayat absensi (Dashboard Absensi) dan daftar hadir sesi latihan.
--
-- Data kehadiran QR yang sudah ada di-backfill dari scanned_at agar waktu
-- kehadirannya tidak semua menjadi waktu migrasi.
--
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ============================================================================

ALTER TABLE public.training_session_attendants
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.training_session_attendants
SET created_at = scanned_at
WHERE scanned_at IS NOT NULL;
