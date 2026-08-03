-- ============================================================================
-- SIORG - MODUL A12 EXTENSION: PENGHAPUSAN ASET INVENTARIS
-- Menambah kolom unit_price, tabel inventory_disposals, dan fungsi
-- dispose_inventory() agar penghapusan aset mengurangi stok & nilai (Rp).
-- Jalankan seluruh SQL ini di Supabase SQL Editor (idempotent).
-- ============================================================================

-- 1. Kolom unit_price (nilai per unit aset, Rp)
ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0);

COMMENT ON COLUMN public.inventory_items.unit_price IS 'Nilai per unit aset (Rp), dasar perhitungan total nilai inventaris';


-- 2. Tabel riwayat penghapusan aset
CREATE TABLE IF NOT EXISTS public.inventory_disposals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    reason          TEXT NOT NULL,
    disposal_date   DATE NOT NULL,
    value_removed   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (value_removed >= 0),
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_disposals IS 'Riwayat penghapusan aset inventaris (A12 ext)';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_disposals_item ON public.inventory_disposals(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_disposals_date ON public.inventory_disposals(disposal_date);


-- 4. ROW LEVEL SECURITY
ALTER TABLE public.inventory_disposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_disposals_select_all" ON public.inventory_disposals;
CREATE POLICY "inventory_disposals_select_all"
    ON public.inventory_disposals FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "inventory_disposals_insert_core" ON public.inventory_disposals;
CREATE POLICY "inventory_disposals_insert_core"
    ON public.inventory_disposals FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );


-- 5. Fungsi penghapusan aset (atomik: catat riwayat + kurangi stok)
CREATE OR REPLACE FUNCTION public.dispose_inventory(
    p_item_id UUID,
    p_quantity INTEGER,
    p_reason TEXT,
    p_disposal_date DATE
)
RETURNS public.inventory_disposals
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_stock INTEGER;
    v_price NUMERIC(12,2);
    v_value NUMERIC(12,2);
    v_row   public.inventory_disposals;
BEGIN
    SELECT stock, unit_price INTO v_stock, v_price
    FROM public.inventory_items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    IF p_quantity > v_stock THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;

    v_value := p_quantity * COALESCE(v_price, 0);

    INSERT INTO public.inventory_disposals (item_id, quantity, reason, disposal_date, value_removed, created_by)
    VALUES (p_item_id, p_quantity, p_reason, p_disposal_date, v_value, auth.uid())
    RETURNING * INTO v_row;

    UPDATE public.inventory_items
    SET stock = stock - p_quantity
    WHERE id = p_item_id;

    RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispose_inventory(UUID, INTEGER, TEXT, DATE) TO authenticated;
