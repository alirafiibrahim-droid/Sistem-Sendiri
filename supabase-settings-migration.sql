-- ============================================================================
-- MIGRATION: Pengaturan Organisasi (Tab Organisasi)
-- 1. Tambah kolom identitas universitas, media sosial, dan tahun berdiri
-- 2. Catatan: org_address & org_phone_number sudah ada di
--    supabase-reports-migration.sql (KOP Surat A13).
-- Jalankan di Supabase Dashboard SQL Editor (idempotent).
-- ============================================================================

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS org_university VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS org_social_media JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS org_est_year VARCHAR(4) NOT NULL DEFAULT '';

COMMENT ON COLUMN public.organization_settings.org_university IS 'Nama universitas/institusi (Tab Organisasi)';
COMMENT ON COLUMN public.organization_settings.org_social_media IS 'Daftar tautan media sosial: [{"platform": "...", "url": "..."}]';
COMMENT ON COLUMN public.organization_settings.org_est_year IS 'Tahun berdiri organisasi (YYYY)';

-- 3. Refresh schema cache PostgREST agar kolom baru langsung dikenali
NOTIFY pgrst, 'reload schema';
