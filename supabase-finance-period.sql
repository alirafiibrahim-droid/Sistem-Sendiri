-- ============================================================================
-- SIORG Migration: Periode Berjalan pada Transaksi Keuangan (A4)
-- ----------------------------------------------------------------------------
-- Menambahkan relasi transaksi keuangan ke periode Sertijab (handovers):
--   * Kolom finances.handover_id menandai periode kepengurusan (Sertijab)
--     tempat transaksi dicatat.
--   * Form '+ Catat Transaksi' mendapat dropdown "Periode Berjalan" yang
--     mengambil periode aktif (status != 'COMPLETED') dari modul Sertijab.
--   * Dashboard Keuangan mendapat kolom "Periode" dan filter yang default-nya
--     ke periode yang sedang berjalan.
--
-- JALANKAN di Supabase SQL Editor.
-- ============================================================================

-- 1. Kolom periode Sertijab pada transaksi keuangan
ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finances_handover ON public.finances(handover_id);

COMMENT ON COLUMN public.finances.handover_id
    IS 'Periode Sertijab (kepengurusan) tempat transaksi dicatat (Periode Berjalan)';
