-- ============================================================================
-- MIGRATION: Modul Pelaporan (A13)
-- 1. Ekstensi organization_settings untuk data KOP Surat
-- 2. Tabel report_files (arsip laporan yang diunduh ke internal storage)
-- Jalankan di Supabase Dashboard SQL Editor (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. KOP SURAT — tambah kolom alamat & telepon pada organization_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS org_address TEXT NOT NULL DEFAULT '';

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS org_phone_number VARCHAR(20) NOT NULL DEFAULT '';

COMMENT ON COLUMN public.organization_settings.org_address IS 'Alamat organisasi untuk KOP Surat (A13)';
COMMENT ON COLUMN public.organization_settings.org_phone_number IS 'Nomor telepon organisasi untuk KOP Surat (A13)';

-- ----------------------------------------------------------------------------
-- 2. TABEL REPORT_FILES (Arsip laporan yang di-generate)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type  VARCHAR(20) NOT NULL,          -- kode katalog: 'RPT-FIN-01'
    report_title VARCHAR(255) NOT NULL,
    format       VARCHAR(10) NOT NULL,          -- 'pdf' | 'xlsx'
    file_url     TEXT NOT NULL,
    filters      JSONB NOT NULL DEFAULT '{}',   -- snapshot parameter saat generasi
    status       VARCHAR(20) NOT NULL DEFAULT 'READY', -- PROCESSING | READY | FAILED
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_files IS 'Arsip laporan yang diunduh ke internal storage (A13)';

CREATE INDEX IF NOT EXISTS idx_report_files_type ON public.report_files(report_type);
CREATE INDEX IF NOT EXISTS idx_report_files_created ON public.report_files(created_at);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.report_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_files_select_own_or_admin" ON public.report_files;
CREATE POLICY "report_files_select_own_or_admin"
    ON public.report_files FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

DROP POLICY IF EXISTS "report_files_insert_own" ON public.report_files;
CREATE POLICY "report_files_insert_own"
    ON public.report_files FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. CATATAN: Buat bucket storage 'reports' via Dashboard > Storage
--    (tidak dapat dibuat lewat SQL). Sifat bucket: private.
-- ----------------------------------------------------------------------------
