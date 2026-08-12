-- ============================================================================
-- Migration: Pos Anggaran (Budget Items) untuk Program Kerja & Proyek Insidental
-- User mengisi anggaran melalui Detail Program/Proyek -> Tab Anggaran.
-- Induk Pos (parent_id IS NULL) bisa berisi nilai langsung atau menjadi
-- "wadah" untuk Anak Pos. Anak Pos (parent_id NOT NULL) menambah sub total.
-- Total Anggaran = SUM(subtotal) seluruh pos.
-- ============================================================================

-- BUDGET ITEMS
CREATE TABLE IF NOT EXISTS public.budget_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID REFERENCES public.programs(id) ON DELETE CASCADE,
    project_id  UUID REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES public.budget_items(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    quantity    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_budget_items_owner CHECK (
        (program_id IS NOT NULL)::int + (project_id IS NOT NULL)::int = 1
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_items_program ON public.budget_items(program_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_project ON public.budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_parent ON public.budget_items(parent_id);

-- Enable RLS
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "budget_items_select_all" ON public.budget_items;
CREATE POLICY "budget_items_select_all"
    ON public.budget_items FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "budget_items_insert_core" ON public.budget_items;
CREATE POLICY "budget_items_insert_core"
    ON public.budget_items FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "budget_items_update_core" ON public.budget_items;
CREATE POLICY "budget_items_update_core"
    ON public.budget_items FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "budget_items_delete_core" ON public.budget_items;
CREATE POLICY "budget_items_delete_core"
    ON public.budget_items FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_budget_items ON public.budget_items;
CREATE TRIGGER set_updated_at_budget_items
    BEFORE UPDATE ON public.budget_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
