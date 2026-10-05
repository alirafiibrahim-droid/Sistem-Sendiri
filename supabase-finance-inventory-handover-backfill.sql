-- ============================================================================
-- MIGRATION: Backfill handover_id untuk transaksi finances dari modul Inventaris
-- Run this in Supabase Dashboard > SQL Editor
--
-- Masalah: transaksi EXPENSE hasil pembelian inventaris dibuat tanpa
-- handover_id, sehingga tidak muncul di modul Keuangan saat filter default
-- "Periode Berjalan" aktif.
--
-- Script ini mengisi handover_id dengan periode Sertijab yang sedang
-- berjalan (status != 'COMPLETED') untuk semua transaksi source='inventory'
-- yang handover_id-nya masih NULL.
-- ============================================================================

UPDATE public.finances
SET handover_id = (
    SELECT h.id
    FROM public.handovers h
    WHERE h.status <> 'COMPLETED'
    ORDER BY h.period_to DESC
    LIMIT 1
)
WHERE source = 'inventory'
  AND handover_id IS NULL
  AND EXISTS (
      SELECT 1 FROM public.handovers h WHERE h.status <> 'COMPLETED'
  );
