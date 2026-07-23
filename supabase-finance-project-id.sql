-- ============================================================================
-- MIGRATION: Add project_id to finances table
-- Links finance entries to incidental projects (Proyek Insidental)
-- ============================================================================

-- 1. Add column
ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.incidental_projects(id) ON DELETE SET NULL;

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_finances_project ON public.finances(project_id);
