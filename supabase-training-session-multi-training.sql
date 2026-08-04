-- ============================================================================
-- SIORG Migration: Training Session multi-latihan + Nama Sesi
-- ----------------------------------------------------------------------------
-- 1. Menambah kolom `name` pada training_sessions (Nama Sesi Latihan)
-- 2. Menambah tabel junction `training_session_trainings`
--    (satu sesi latihan dapat memiliki banyak latihan / variabel penilaian)
-- 3. RLS untuk tabel junction
--
-- JALANKAN di Supabase SQL Editor.
-- ============================================================================

-- 1. Nama sesi latihan
ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- 2. Tabel junction: sesi -> banyak latihan
CREATE TABLE IF NOT EXISTS public.training_session_trainings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, training_id)
);

COMMENT ON TABLE public.training_session_trainings
    IS 'Relasi sesi latihan dengan banyak latihan (variabel penilaian) (A3)';

CREATE INDEX IF NOT EXISTS idx_ts_trainings_session
    ON public.training_session_trainings(session_id);
CREATE INDEX IF NOT EXISTS idx_ts_trainings_training
    ON public.training_session_trainings(training_id);

-- 3. RLS
ALTER TABLE public.training_session_trainings ENABLE ROW LEVEL SECURITY;

-- Semua authenticated bisa membaca
CREATE POLICY "ts_trainings_select_all"
    ON public.training_session_trainings FOR SELECT
    TO authenticated
    USING (true);

-- Hanya pelatih/core/admin yang bisa menambah relasi
CREATE POLICY "ts_trainings_insert_coach"
    ON public.training_session_trainings FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
        OR EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.id = session_id
              AND ts.coach_id = auth.uid()
        )
    );

CREATE POLICY "ts_trainings_delete_coach"
    ON public.training_session_trainings FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
        OR EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.id = session_id
              AND ts.coach_id = auth.uid()
        )
    );
