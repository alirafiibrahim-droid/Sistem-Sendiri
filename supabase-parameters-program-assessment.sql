-- ============================================================================
-- MIGRASI: Master Parameter + Penilaian per Parameter pada Program Kerja
--
-- 1. public.parameters
--    Master data parameter penilaian (diPengaturan > Parameter).
--    Satu baris = satu parameter, dipakai sebagai kolom penilaian pada form
--    "Penilaian" anggota yang hadir di sesi Program Kerja.
--
-- 2. public.program_session_attendant_scores
--    Menyimpan nilai tiap peserta untuk tiap parameter.
--    Kolom `score` pada program_session_attendants tetap dipakai sebagai
--    RATA-RATA dari seluruh nilai parameter peserta tersebut, agar rata-rata
--    pada daftar Program Kerja & laporan tetap konsisten.
--
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PARAMETERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parameters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parameters IS 'Master parameter penilaian anggota pada sesi Program Kerja';

CREATE INDEX IF NOT EXISTS idx_parameters_name ON public.parameters(name);

-- ----------------------------------------------------------------------------
-- 2. PROGRAM SESSION ATTENDANT SCORES (nilai per parameter)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_session_attendant_scores (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendant_id UUID NOT NULL REFERENCES public.program_session_attendants(id) ON DELETE CASCADE,
    parameter_id UUID NOT NULL REFERENCES public.parameters(id) ON DELETE CASCADE,
    score        INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT program_session_attendant_scores_unique UNIQUE (attendant_id, parameter_id)
);

COMMENT ON TABLE public.program_session_attendant_scores IS 'Nilai tiap parameter penilaian untuk peserta sesi Program Kerja';

CREATE INDEX IF NOT EXISTS idx_psas_attendant ON public.program_session_attendant_scores(attendant_id);
CREATE INDEX IF NOT EXISTS idx_psas_parameter ON public.program_session_attendant_scores(parameter_id);

-- ----------------------------------------------------------------------------
-- 3. TRIGGERS updated_at
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at_parameters ON public.parameters;
CREATE TRIGGER set_updated_at_parameters
    BEFORE UPDATE ON public.parameters
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_psas ON public.program_session_attendant_scores;
CREATE TRIGGER set_updated_at_psas
    BEFORE UPDATE ON public.program_session_attendant_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RLS - PARAMETERS
--    Semua authenticated bisa melihat; ubah data olehgmt inti (mengikuti
--    access matrix modul "settings-parameters").
-- ----------------------------------------------------------------------------
ALTER TABLE public.parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parameters_select_all" ON public.parameters;
CREATE POLICY "parameters_select_all"
    ON public.parameters FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "parameters_insert_core" ON public.parameters;
CREATE POLICY "parameters_insert_core"
    ON public.parameters FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'WAKIL_KETUA', 'KETUA_UMUM')
    );

DROP POLICY IF EXISTS "parameters_update_core" ON public.parameters;
CREATE POLICY "parameters_update_core"
    ON public.parameters FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'WAKIL_KETUA', 'KETUA_UMUM')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'WAKIL_KETUA', 'KETUA_UMUM')
    );

DROP POLICY IF EXISTS "parameters_delete_core" ON public.parameters;
CREATE POLICY "parameters_delete_core"
    ON public.parameters FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'WAKIL_KETUA', 'KETUA_UMUM')
    );

-- ----------------------------------------------------------------------------
-- 5. RLS - PROGRAM SESSION ATTENDANT SCORES
--    Sama seperti program_session_attendants: semua bisa baca, yang managing
--    absensi (ADMIN/PENGURUS_INTI/KABID) boleh mengubah.
-- ----------------------------------------------------------------------------
ALTER TABLE public.program_session_attendant_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psas_select_all" ON public.program_session_attendant_scores;
CREATE POLICY "psas_select_all"
    ON public.program_session_attendant_scores FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "psas_manage_core" ON public.program_session_attendant_scores;
CREATE POLICY "psas_manage_core"
    ON public.program_session_attendant_scores FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- 6. SEED DATA
--    Satu parameter bawaan supaya form penilaian tetap punya kolom dasar.
-- ----------------------------------------------------------------------------
INSERT INTO public.parameters (name, description) VALUES
    ('Nilai', 'Nilai umum anggota yang hadir di sesi Program Kerja')
ON CONFLICT (name) DO NOTHING;