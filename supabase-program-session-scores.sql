-- ============================================================================
-- MIGRASI: Nilai kehadiran anggota pada sesi program kerja (1-10)
--
-- Menambahkan kolom `score` pada tabel program_session_attendants.
-- Nilai boleh NULL (belum dinilai) atau integer 1-10.
--
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ============================================================================

ALTER TABLE public.program_session_attendants
  ADD COLUMN IF NOT EXISTS score INTEGER
  CHECK (score IS NULL OR (score >= 1 AND score <= 10));
