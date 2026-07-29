-- ============================================================================
-- Attendance Module — Presensi Kehadiran Anggota di Program Kerja
-- Execute this in Supabase Dashboard SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS (ensure they exist; skip if already created)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.attendance_status AS ENUM ('PRESENT', 'ABSENT', 'SICK', 'PERMIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attendance_method AS ENUM ('MANUAL', 'QR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE (if not exists)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status      public.attendance_status NOT NULL DEFAULT 'PRESENT',
    method      public.attendance_method NOT NULL DEFAULT 'MANUAL',
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    scanned_at  TIMESTAMPTZ,
    UNIQUE(program_id, user_id)
);

COMMENT ON TABLE public.attendances IS 'Presensi kehadiran anggota di program kerja';

-- ----------------------------------------------------------------------------
-- 2b. PROJECT ATTENDANCE TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_attendances (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method     public.attendance_method NOT NULL DEFAULT 'MANUAL',
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT now(),
    scanned_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

COMMENT ON TABLE public.project_attendances IS 'Presensi kehadiran anggota di proyek insidental';

CREATE INDEX IF NOT EXISTS idx_project_attendances_project ON public.project_attendances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_attendances_user ON public.project_attendances(user_id);

ALTER TABLE public.project_attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_attendances_select_all" ON public.project_attendances;
CREATE POLICY "project_attendances_select_all"
    ON public.project_attendances FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "project_attendances_insert_own" ON public.project_attendances;
CREATE POLICY "project_attendances_insert_own"
    ON public.project_attendances FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "project_attendances_manage_core" ON public.project_attendances;
CREATE POLICY "project_attendances_manage_core"
    ON public.project_attendances FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendances_program ON public.attendances(program_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user ON public.attendances(user_id);

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read attendances
DROP POLICY IF EXISTS "attendances_select_all" ON public.attendances;
CREATE POLICY "attendances_select_all"
    ON public.attendances FOR SELECT
    TO authenticated
    USING (true);

-- All authenticated users can insert their own attendance
DROP POLICY IF EXISTS "attendances_insert_own" ON public.attendances;
CREATE POLICY "attendances_insert_own"
    ON public.attendances FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Admin / Pengurus Inti / Kabid can manage all attendances
DROP POLICY IF EXISTS "attendances_manage_core" ON public.attendances;
CREATE POLICY "attendances_manage_core"
    ON public.attendances FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );
