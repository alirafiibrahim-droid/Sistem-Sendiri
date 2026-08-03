-- ============================================================================
-- Migration: Proyek Insidental (A10)
-- Tabel, RLS, trigger, function untuk incidental_projects dan relasinya
-- ============================================================================

-- 1. Enums
-- Catatan: PostgreSQL TIDAK mendukung "IF NOT EXISTS" pada CREATE TYPE,
-- jadi gunakan DO block untuk membuat enum hanya jika belum ada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'project_status'
    ) THEN
        CREATE TYPE public.project_status AS ENUM ('PROPOSED', 'APPROVED', 'ONGOING', 'CLOSED');
    END IF;
END $$;

-- Ensure finance_type enum exists (used by project_funds)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'finance_type'
    ) THEN
        CREATE TYPE public.finance_type AS ENUM ('INCOME', 'EXPENSE');
    END IF;
END $$;

-- INCIDENTAL PROJECTS
CREATE TABLE IF NOT EXISTS public.incidental_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    urgency_level   VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    start_date      DATE NOT NULL,
    end_date        DATE,
    budget_source   VARCHAR(255),
    status          public.project_status NOT NULL DEFAULT 'PROPOSED',
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECT FUNDS
CREATE TABLE IF NOT EXISTS public.project_funds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    type        public.finance_type NOT NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    source      VARCHAR(255),
    description TEXT,
    date        DATE NOT NULL,
    receipt_url TEXT,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECT TEAM
CREATE TABLE IF NOT EXISTS public.project_team (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_role  VARCHAR(100),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- PROJECT MILESTONES
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    due_date      DATE,
    is_completed  BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidental_projects_status ON public.incidental_projects(status);

-- Enable RLS
ALTER TABLE public.incidental_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "incidental_projects_select_all" ON public.incidental_projects;
CREATE POLICY "incidental_projects_select_all"
    ON public.incidental_projects FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "incidental_projects_insert_core_kabid" ON public.incidental_projects;
CREATE POLICY "incidental_projects_insert_core_kabid"
    ON public.incidental_projects FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "incidental_projects_update_core_kabid" ON public.incidental_projects;
CREATE POLICY "incidental_projects_update_core_kabid"
    ON public.incidental_projects FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "incidental_projects_delete_admin" ON public.incidental_projects;
CREATE POLICY "incidental_projects_delete_admin"
    ON public.incidental_projects FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "project_team_select_all" ON public.project_team;
CREATE POLICY "project_team_select_all"
    ON public.project_team FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "project_team_manage_core" ON public.project_team;
CREATE POLICY "project_team_manage_core"
    ON public.project_team FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "project_funds_select_team_or_admin" ON public.project_funds;
CREATE POLICY "project_funds_select_team_or_admin"
    ON public.project_funds FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_funds.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

DROP POLICY IF EXISTS "project_funds_insert_team_or_admin" ON public.project_funds;
CREATE POLICY "project_funds_insert_team_or_admin"
    ON public.project_funds FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_funds.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

DROP POLICY IF EXISTS "project_milestones_select_all" ON public.project_milestones;
CREATE POLICY "project_milestones_select_all"
    ON public.project_milestones FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "project_milestones_manage_team" ON public.project_milestones;
CREATE POLICY "project_milestones_manage_team"
    ON public.project_milestones FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_milestones.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_milestones.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- Trigger for updated_at
-- Catatan: PostgreSQL TIDAK mendukung "IF NOT EXISTS" pada CREATE TRIGGER,
-- jadi drop dulu (jika ada) lalu buat ulang.
-- Pastikan fungsi public.handle_updated_at() tersedia (idempotent).
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_incidental_projects ON public.incidental_projects;
CREATE TRIGGER set_updated_at_incidental_projects
    BEFORE UPDATE ON public.incidental_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Cash balance function
CREATE OR REPLACE FUNCTION public.get_project_cash_balance(p_project_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_income  NUMERIC(12,2);
    v_expense NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_income
    FROM public.project_funds
    WHERE project_id = p_project_id AND type = 'INCOME';

    SELECT COALESCE(SUM(amount), 0) INTO v_expense
    FROM public.project_funds
    WHERE project_id = p_project_id AND type = 'EXPENSE';

    RETURN v_income - v_expense;
END;
$$;
