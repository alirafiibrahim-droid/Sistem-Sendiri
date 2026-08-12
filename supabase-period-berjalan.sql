-- ============================================================================
-- Periode Berjalan (handover_id) pada modul Prestasi, Persuratan, Proyek Insidental
--   Prestasi, Surat, dan Proyek dikaitkan dengan periode Sertijab yang sedang
--   berjalan (status != COMPLETED).
--   Jalankan di Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Achievements
ALTER TABLE public.achievements
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_achievements_handover ON public.achievements(handover_id);

-- 2. Letters
ALTER TABLE public.letters
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_letters_handover ON public.letters(handover_id);

-- 3. Incidental Projects
ALTER TABLE public.incidental_projects
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidental_projects_handover ON public.incidental_projects(handover_id);

-- 4. Refresh schema cache PostgREST agar kolom baru langsung dikenali
NOTIFY pgrst, 'reload schema';
