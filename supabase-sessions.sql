-- ============================================================================
-- Sessions Module — Sesi Pertemuan untuk Program Kerja & Proyek Insidental
-- Execute this in Supabase Dashboard SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROGRAM SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id   UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    date         DATE NOT NULL,
    title        VARCHAR(200),
    session_code VARCHAR(7) UNIQUE,
    start_time   VARCHAR(5),
    end_time     VARCHAR(5),
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.program_sessions IS 'Sesi pertemuan program kerja (A9)';

CREATE INDEX IF NOT EXISTS idx_program_sessions_program ON public.program_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_program_sessions_date ON public.program_sessions(date);

ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_sessions_select_all" ON public.program_sessions;
CREATE POLICY "program_sessions_select_all"
    ON public.program_sessions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "program_sessions_insert_core_kabid" ON public.program_sessions;
CREATE POLICY "program_sessions_insert_core_kabid"
    ON public.program_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "program_sessions_delete_core_kabid" ON public.program_sessions;
CREATE POLICY "program_sessions_delete_core_kabid"
    ON public.program_sessions FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- 2. PROGRAM SESSION ATTENDANTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_session_attendants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.program_sessions(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method     public.attendance_method NOT NULL DEFAULT 'MANUAL',
    scanned_at TIMESTAMPTZ,
    score      INTEGER CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, user_id)
);

COMMENT ON TABLE public.program_session_attendants IS 'Presensi kehadiran anggota di sesi program kerja';

CREATE INDEX IF NOT EXISTS idx_program_session_attendants_session ON public.program_session_attendants(session_id);
CREATE INDEX IF NOT EXISTS idx_program_session_attendants_user ON public.program_session_attendants(user_id);

ALTER TABLE public.program_session_attendants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_session_attendants_select_all" ON public.program_session_attendants;
CREATE POLICY "program_session_attendants_select_all"
    ON public.program_session_attendants FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "program_session_attendants_insert_own" ON public.program_session_attendants;
CREATE POLICY "program_session_attendants_insert_own"
    ON public.program_session_attendants FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "program_session_attendants_manage_core" ON public.program_session_attendants;
CREATE POLICY "program_session_attendants_manage_core"
    ON public.program_session_attendants FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- 3. PROJECT SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    date         DATE NOT NULL,
    title        VARCHAR(200),
    session_code VARCHAR(7) UNIQUE,
    start_time   VARCHAR(5),
    end_time     VARCHAR(5),
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_sessions IS 'Sesi pertemuan proyek insidental (A10)';

CREATE INDEX IF NOT EXISTS idx_project_sessions_project ON public.project_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_sessions_date ON public.project_sessions(date);

ALTER TABLE public.project_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_sessions_select_all" ON public.project_sessions;
CREATE POLICY "project_sessions_select_all"
    ON public.project_sessions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "project_sessions_insert_core_kabid" ON public.project_sessions;
CREATE POLICY "project_sessions_insert_core_kabid"
    ON public.project_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

DROP POLICY IF EXISTS "project_sessions_delete_core_kabid" ON public.project_sessions;
CREATE POLICY "project_sessions_delete_core_kabid"
    ON public.project_sessions FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- 4. PROJECT SESSION ATTENDANTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_session_attendants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.project_sessions(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method     public.attendance_method NOT NULL DEFAULT 'MANUAL',
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, user_id)
);

COMMENT ON TABLE public.project_session_attendants IS 'Presensi kehadiran anggota di sesi proyek insidental';

CREATE INDEX IF NOT EXISTS idx_project_session_attendants_session ON public.project_session_attendants(session_id);
CREATE INDEX IF NOT EXISTS idx_project_session_attendants_user ON public.project_session_attendants(user_id);

ALTER TABLE public.project_session_attendants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_session_attendants_select_all" ON public.project_session_attendants;
CREATE POLICY "project_session_attendants_select_all"
    ON public.project_session_attendants FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "project_session_attendants_insert_own" ON public.project_session_attendants;
CREATE POLICY "project_session_attendants_insert_own"
    ON public.project_session_attendants FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "project_session_attendants_manage_core" ON public.project_session_attendants;
CREATE POLICY "project_session_attendants_manage_core"
    ON public.project_session_attendants FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );
