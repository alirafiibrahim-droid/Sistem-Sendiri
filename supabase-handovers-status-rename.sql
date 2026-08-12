-- ============================================================================
-- MIGRASI: Rename status periode Sertijab (handovers)
-- DRAFT   -> NOT_STARTED (Belum Berjalan)
-- SIGNED  -> ONGOING     (Berjalan)
-- COMPLETED tetap COMPLETED (Selesai Periode)
--
-- Jalankan di Supabase Dashboard -> SQL Editor
-- ============================================================================

ALTER TYPE public.handover_status RENAME VALUE 'DRAFT' TO 'NOT_STARTED';
ALTER TYPE public.handover_status RENAME VALUE 'SIGNED' TO 'ONGOING';
