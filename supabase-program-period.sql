-- ============================================================================
-- A9: Tambah Periode (handover_id) pada Program Kerja
--   Program Kerja dikaitkan dengan periode Sertijab yang sedang berjalan.
--   Jalankan di Supabase Dashboard > SQL Editor.
-- ============================================================================

-- 1. Tambahkan kolom handover_id (Periode Sertijab) ke tabel programs
ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

-- 2. Index untuk pencarian program per periode
CREATE INDEX IF NOT EXISTS idx_programs_handover ON public.programs(handover_id);

-- 3. Refresh schema cache PostgREST agar kolom baru langsung dikenali
NOTIFY pgrst, 'reload schema';
