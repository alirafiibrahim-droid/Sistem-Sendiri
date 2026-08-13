-- ============================================================================
-- MIGRATION: inventory_purchases quantity & subtotal
-- Menambahkan kolom Jumlah (quantity) dan Subtotal (Jumlah x Nominal) pada
-- pencatatan pembelian barang inventaris. Jumlah menentukan penambahan stok.
-- ============================================================================

-- 1. Tambah kolom quantity & subtotal
ALTER TABLE public.inventory_purchases
    ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0);

-- 2. Backfill data lama: quantity = 1, subtotal = amount * quantity
UPDATE public.inventory_purchases
    SET quantity = 1,
        subtotal = amount * quantity
    WHERE subtotal = 0 OR quantity IS NULL;
