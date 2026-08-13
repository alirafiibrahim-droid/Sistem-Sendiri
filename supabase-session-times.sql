-- ============================================================================
-- MIGRATION: Jam sesi (start_time / end_time) pada sesi pertemuan
-- - program_sessions & project_sessions : Jam Mulai (start_time) & Jam Sampai (end_time)
-- - training_sessions                  : Jam Mulai (start_time) saja
--   (jam selesai sesi latihan dihitung dari start_time + duration_minutes)
-- Format waktu: HH:MM (VARCHAR(5))
-- ============================================================================

ALTER TABLE public.program_sessions
    ADD COLUMN IF NOT EXISTS start_time VARCHAR(5),
    ADD COLUMN IF NOT EXISTS end_time VARCHAR(5);

ALTER TABLE public.project_sessions
    ADD COLUMN IF NOT EXISTS start_time VARCHAR(5),
    ADD COLUMN IF NOT EXISTS end_time VARCHAR(5);

ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS start_time VARCHAR(5);
