-- ============================================================================
-- SIORG Migration: Izinkan Edit/Update Transaksi Keuangan (A4)
-- ----------------------------------------------------------------------------
-- Sebelumnya jurnal keuangan bersifat IMMUTABLE (trigger memblokir UPDATE &
-- DELETE). Sesuai kebutuhan baru, transaksi kini BOLEH di-edit sehingga saldo
-- dan card summary di dashboard Keuangan ikut ter-update.
--
-- Catatan: penghapusan jurnal tetap diblokir (prinsip akuntansi).
--
-- JALANKAN di Supabase SQL Editor.
-- ============================================================================

-- 1. Hapus trigger yang memblokir UPDATE pada public.finances
DROP TRIGGER IF EXISTS trg_finances_no_update ON public.finances;

-- 2. RLS: izinkan UPDATE untuk role pengelola keuangan
--    (sinkron dengan requireRole(["PENGURUS_INTI","KABID"]) di API PATCH;
--     ADMIN selalu lolos)
DROP POLICY IF EXISTS "finances_update_admin_core" ON public.finances;
CREATE POLICY "finances_update_admin_core"
    ON public.finances FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );
