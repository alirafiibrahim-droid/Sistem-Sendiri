-- ============================================================================
-- MIGRATION: Tambah tabel Fakultas & Jurusan untuk Modul Pengaturan
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FAKULTAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fakultas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fakultas IS 'Daftar fakultas (A6)';

-- ----------------------------------------------------------------------------
-- 2. JURUSAN (relasi ke fakultas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jurusan (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    fakultas_id UUID REFERENCES public.fakultas(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jurusan IS 'Daftar jurusan/program studi (A6)';

-- ----------------------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_jurusan_fakultas ON public.jurusan(fakultas_id);

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS updated_at
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at_fakultas
    BEFORE UPDATE ON public.fakultas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_jurusan
    BEFORE UPDATE ON public.jurusan
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS (semua authenticated bisa SELECT; ADMIN/PENGURUS_INTI bisa INSERT/UPDATE/DELETE)
-- ----------------------------------------------------------------------------
ALTER TABLE public.fakultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurusan ENABLE ROW LEVEL SECURITY;

-- FAKULTAS
CREATE POLICY "fakultas_select_all" ON public.fakultas FOR SELECT TO authenticated USING (true);

CREATE POLICY "fakultas_insert_admin_core"
    ON public.fakultas FOR INSERT TO authenticated
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'));

CREATE POLICY "fakultas_update_admin_core"
    ON public.fakultas FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'))
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'));

CREATE POLICY "fakultas_delete_admin"
    ON public.fakultas FOR DELETE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN');

-- JURUSAN
CREATE POLICY "jurusan_select_all" ON public.jurusan FOR SELECT TO authenticated USING (true);

CREATE POLICY "jurusan_insert_admin_core"
    ON public.jurusan FOR INSERT TO authenticated
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'));

CREATE POLICY "jurusan_update_admin_core"
    ON public.jurusan FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'))
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI'));

CREATE POLICY "jurusan_delete_admin"
    ON public.jurusan FOR DELETE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- 6. SEED DATA
-- ----------------------------------------------------------------------------
INSERT INTO public.fakultas (name, description) VALUES
    ('Fakultas Ekonomi dan Bisnis', 'Fakultas Ekonomi dan Bisnis'),
    ('Fakultas Hukum', 'Fakultas Hukum'),
    ('Fakultas Ilmu Komputer', 'Fakultas Ilmu Komputer'),
    ('Fakultas Teknik', 'Fakultas Teknik'),
    ('Fakultas Ilmu Sosial dan Ilmu Politik', 'Fakultas Ilmu Sosial dan Ilmu Politik')
ON CONFLICT (name) DO NOTHING;

-- Insert jurusan (pastikan fakultas sudah ada)
INSERT INTO public.jurusan (name, description, fakultas_id)
SELECT 'Sistem Informasi', 'S1 Sistem Informasi', id FROM public.fakultas WHERE name = 'Fakultas Ilmu Komputer'
UNION ALL
SELECT 'Teknik Informatika', 'S1 Teknik Informatika', id FROM public.fakultas WHERE name = 'Fakultas Ilmu Komputer'
UNION ALL
SELECT 'Ilmu Hukum', 'S1 Ilmu Hukum', id FROM public.fakultas WHERE name = 'Fakultas Hukum'
UNION ALL
SELECT 'Manajemen', 'S1 Manajemen', id FROM public.fakultas WHERE name = 'Fakultas Ekonomi dan Bisnis'
UNION ALL
SELECT 'Akuntansi', 'S1 Akuntansi', id FROM public.fakultas WHERE name = 'Fakultas Ekonomi dan Bisnis'
UNION ALL
SELECT 'Ilmu Komunikasi', 'S1 Ilmu Komunikasi', id FROM public.fakultas WHERE name = 'Fakultas Ilmu Sosial dan Ilmu Politik'
ON CONFLICT (name) DO NOTHING;
