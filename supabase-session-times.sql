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

-- Periode Berjalan (Sertijab) pada Sesi Latihan
ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_handover
    ON public.training_sessions(handover_id);
