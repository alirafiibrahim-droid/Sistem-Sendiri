-- ============================================================================
-- MIGRATION: Athletics V2 — Training master data, Spider Chart, QR Attendance
-- ============================================================================

-- 1. ENUM: Training Category
CREATE TYPE public.training_category AS ENUM (
  'STRENGTH', 'POWER', 'SPEED', 'AGILITY',
  'ENDURANCE', 'FLEXIBILITY', 'TEKNIK', 'MENTAL', 'GAME_INTELLIGENCE'
);

-- 2. ENUM: Attendance method
CREATE TYPE public.attendance_method AS ENUM ('MANUAL', 'QR');

-- 3. TABLE: Trainings (Master data Latihan)
CREATE TABLE IF NOT EXISTS public.trainings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  category   public.training_category NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trainings IS 'Master data latihan — nama + kategori';

CREATE INDEX IF NOT EXISTS idx_trainings_category ON public.trainings(category);

-- 4. ALTER: athletic_metrics gets category column
ALTER TABLE public.athletic_metrics
  ADD COLUMN IF NOT EXISTS category public.training_category;

CREATE INDEX IF NOT EXISTS idx_athletic_metrics_category ON public.athletic_metrics(category);

-- 5. ALTER: training_sessions gets training_id FK
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_training ON public.training_sessions(training_id);

-- 6. ALTER: training_session_attendants gets method + scanned_at
ALTER TABLE public.training_session_attendants
  ADD COLUMN IF NOT EXISTS method public.attendance_method NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

-- 7. RLS: trainings
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainings_select_all"
  ON public.trainings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "trainings_manage_core"
  ON public.trainings FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'PENGURUS_INTI', 'KABID', 'PELATIH')
    )
  );
