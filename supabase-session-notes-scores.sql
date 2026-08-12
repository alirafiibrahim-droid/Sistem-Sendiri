-- ============================================================================
-- MIGRASI: Catatan (notes) pada penilaian sesi program kerja
--          serta nilai (score) dan catatan (notes) pada sesi proyek insidental
--
-- 1. program_session_attendants  -> menambahkan kolom `notes` (TEXT, opsional)
-- 2. project_session_attendants  -> menambahkan kolom `score` (INTEGER 1-10)
--    dan kolom `notes` (TEXT, opsional). Nilai score boleh NULL (belum dinilai).
--
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ============================================================================

ALTER TABLE public.program_session_attendants
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.project_session_attendants
  ADD COLUMN IF NOT EXISTS score INTEGER
  CHECK (score IS NULL OR (score >= 1 AND score <= 10));

ALTER TABLE public.project_session_attendants
  ADD COLUMN IF NOT EXISTS notes TEXT;
