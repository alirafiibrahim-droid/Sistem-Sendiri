-- ============================================================================
-- MIGRATION: inventory_purchases table
-- Creates purchase tracking for inventory items with auto-expense in finance
-- ============================================================================

-- 1. Create the table
CREATE TABLE public.inventory_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date            DATE NOT NULL,
    wallet_id       UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    bank_id         UUID REFERENCES public.banks(id) ON DELETE SET NULL,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
    description     TEXT NOT NULL DEFAULT '',
    finance_id      UUID REFERENCES public.finances(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_purchases IS 'Pencatatan pembelian barang inventaris (A12)';

-- 2. Enable RLS
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "inventory_purchases_select_all"
    ON public.inventory_purchases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_purchases_insert_core"
    ON public.inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID', 'BENDAHARA')
    );

CREATE POLICY "inventory_purchases_update_core"
    ON public.inventory_purchases FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'BENDAHARA')
    );

CREATE POLICY "inventory_purchases_delete_admin"
    ON public.inventory_purchases FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- 4. Indexes
CREATE INDEX idx_inventory_purchases_item ON public.inventory_purchases(item_id);
CREATE INDEX idx_inventory_purchases_date ON public.inventory_purchases(date);
CREATE INDEX idx_inventory_purchases_finance ON public.inventory_purchases(finance_id);
