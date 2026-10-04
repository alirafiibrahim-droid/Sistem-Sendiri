-- ============================================================================
-- MIGRATION: inventory_purchases other_cost
-- Menambahkan kolom Biaya Lainnya (ongkir, pajak, dll) pada pencatatan
-- pembelian barang inventaris. Nominal ini ditambahkan ke subtotal dan
-- ikut menjadi nilai expense pada catatan keuangan otomatis.
-- ============================================================================

-- 1. Tambah kolom other_cost
ALTER TABLE public.inventory_purchases
    ADD COLUMN IF NOT EXISTS other_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0);

COMMENT ON COLUMN public.inventory_purchases.other_cost IS 'Biaya tambahan pembelian (ongkir, pajak, dll) dalam Rupiah';

-- 2. Samakan subtotal lama agar konsisten dengan perhitungan baru
--    subtotal = (quantity * amount) + other_cost
UPDATE public.inventory_purchases
    SET subtotal = (quantity * amount) + other_cost
    WHERE subtotal <> (quantity * amount) + other_cost;