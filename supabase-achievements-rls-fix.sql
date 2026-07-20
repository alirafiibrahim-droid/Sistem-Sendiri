-- ============================================================================
-- Migration: Achievements - RLS policies untuk achievement_participants
-- ============================================================================

-- RLS policies untuk achievement_participants (sebelumnya tidak ada)
CREATE POLICY "achievement_participants_select_all"
    ON public.achievement_participants FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "achievement_participants_insert_auth"
    ON public.achievement_participants FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "achievement_participants_delete_core"
    ON public.achievement_participants FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );
