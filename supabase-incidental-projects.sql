-- ============================================================================
-- Migration: Proyek Insidental (A10)
-- Tabel, RLS, trigger, function untuk incidental_projects dan relasinya
-- ============================================================================

-- 1. Enums
CREATE TYPE public.project_status AS ENUM ('PROPOSED', 'APPROVED', 'ONGOING', 'CLOSED');

-- Ensure finance_type enum exists (used by project_funds)
CREATE TYPE IF NOT EXISTS public.finance_type AS ENUM ('INCOME', 'EXPENSE');

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
CREATE POLICY "incidental_projects_select_all"
    ON public.incidental_projects FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "incidental_projects_insert_core_kabid"
    ON public.incidental_projects FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "incidental_projects_update_core"
    ON public.incidental_projects FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "incidental_projects_delete_admin"
    ON public.incidental_projects FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

CREATE POLICY "project_team_select_all"
    ON public.project_team FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "project_team_manage_core"
    ON public.project_team FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

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

CREATE POLICY "project_funds_insert_team_or_admin"
    ON public.project_funds FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = NEW.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "project_milestones_select_all"
    ON public.project_milestones FOR SELECT
    TO authenticated
    USING (true);

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
    );

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS set_updated_at_incidental_projects
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
