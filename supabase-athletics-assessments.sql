-- ============================================================================
-- MIGRATION: Athletics V2 Assessments — seed metrics + sample data
-- ============================================================================

-- 1. Seed athletic_metrics: one per training category (for spider chart)
INSERT INTO public.athletic_metrics (name, type, unit, category)
VALUES
  ('Penilaian Strength', 'QUANTITATIVE', 'skala 1-10', 'STRENGTH'),
  ('Penilaian Power', 'QUANTITATIVE', 'skala 1-10', 'POWER'),
  ('Penilaian Speed', 'QUANTITATIVE', 'skala 1-10', 'SPEED'),
  ('Penilaian Agility', 'QUANTITATIVE', 'skala 1-10', 'AGILITY'),
  ('Penilaian Endurance', 'QUANTITATIVE', 'skala 1-10', 'ENDURANCE'),
  ('Penilaian Flexibility', 'QUANTITATIVE', 'skala 1-10', 'FLEXIBILITY'),
  ('Penilaian Teknik', 'QUANTITATIVE', 'skala 1-10', 'TEKNIK'),
  ('Penilaian Mental', 'QUANTITATIVE', 'skala 1-10', 'MENTAL'),
  ('Penilaian Game Intelligence', 'QUANTITATIVE', 'skala 1-10', 'GAME_INTELLIGENCE')
ON CONFLICT DO NOTHING;

-- 2. Update assessments INSERT policy to allow PELATIH and KABID
DROP POLICY IF EXISTS "assessments_insert_coach" ON public.assessments;

CREATE POLICY "assessments_insert_coach"
    ON public.assessments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = NEW.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'PELATIH', 'KABID')
    );

-- 3. Update assessments SELECT policy to allow PELATIH
DROP POLICY IF EXISTS "assessments_select_own_or_coach" ON public.assessments;

CREATE POLICY "assessments_select_own_or_coach"
    ON public.assessments FOR SELECT
    TO authenticated
    USING (
        athlete_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = assessments.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'PELATIH', 'KABID')
    );
