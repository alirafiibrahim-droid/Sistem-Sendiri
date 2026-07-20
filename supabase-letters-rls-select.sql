-- ============================================================================
-- Migration: Letters - RLS SELECT policy + fix document_url default
-- ============================================================================

-- 1. Fix document_url to allow empty string default (existing rows stay unchanged)
ALTER TABLE public.letters ALTER COLUMN document_url SET DEFAULT '';

-- 2. Add missing SELECT RLS policy for letters
--    PUBLIC: semua authenticated user bisa baca
--    CONFIDENTIAL: hanya ADMIN, PENGURUS_INTI, KABID, atau pembuat surat
CREATE POLICY "letters_select_all"
    ON public.letters FOR SELECT
    TO authenticated
    USING (
        classification = 'PUBLIC'
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
        OR created_by = auth.uid()
    );
