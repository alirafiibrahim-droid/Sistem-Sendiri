-- ============================================================================
-- Migration: Keatletan - Training Sessions, Metrics, Assessments, Targets
-- ============================================================================

-- Enums
CREATE TYPE IF NOT EXISTS public.metric_type AS ENUM ('QUANTITATIVE', 'QUALITATIVE');
CREATE TYPE IF NOT EXISTS public.intensity_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Athletic Metrics
CREATE TABLE IF NOT EXISTS public.athletic_metrics (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    type       public.metric_type NOT NULL,
    unit       VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Athlete Coach Mapping
CREATE TABLE IF NOT EXISTS public.athlete_coach_mapping (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(coach_id, athlete_id)
);

-- Training Sessions
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    date             DATE NOT NULL,
    session_type     VARCHAR(50),
    duration_minutes INTEGER,
    intensity        public.intensity_level,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training Session Attendants
CREATE TABLE IF NOT EXISTS public.training_session_attendants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(session_id, athlete_id)
);

-- Assessments
CREATE TABLE IF NOT EXISTS public.assessments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
    athlete_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_id   UUID NOT NULL REFERENCES public.athletic_metrics(id) ON DELETE CASCADE,
    value       NUMERIC NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Athlete Targets
CREATE TABLE IF NOT EXISTS public.athlete_targets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_id     UUID NOT NULL REFERENCES public.athletic_metrics(id) ON DELETE CASCADE,
    target_value  NUMERIC NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(athlete_id, metric_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_athlete ON public.assessments(athlete_id);
CREATE INDEX IF NOT EXISTS idx_assessments_metric ON public.assessments(metric_id);

-- Enable RLS
ALTER TABLE public.athletic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_targets ENABLE ROW LEVEL SECURITY;

-- RLS: Athletic Metrics
CREATE POLICY "athletic_metrics_select_all"
    ON public.athletic_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "athletic_metrics_manage_core"
    ON public.athletic_metrics FOR ALL TO authenticated USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- RLS: Training Sessions
CREATE POLICY "training_sessions_select_all"
    ON public.training_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_sessions_insert_coach"
    ON public.training_sessions FOR INSERT TO authenticated WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
        OR coach_id = auth.uid()
    );

-- RLS: Assessments
CREATE POLICY "assessments_select_own_or_coach"
    ON public.assessments FOR SELECT TO authenticated USING (
        athlete_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = assessments.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "assessments_insert_coach"
    ON public.assessments FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = assessments.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

-- RLS: Athlete Targets
CREATE POLICY "athlete_targets_select_own_or_admin"
    ON public.athlete_targets FOR SELECT TO authenticated USING (
        athlete_id = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "athlete_targets_manage_core"
    ON public.athlete_targets FOR ALL TO authenticated USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );
