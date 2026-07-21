-- ============================================================================
-- MIGRATION: Tambahkan tabel Banks, Kas, dan Dompet (Wallets)
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABEL BANKS (Data rekening bank organisasi)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    account_number  VARCHAR(50) NOT NULL,
    account_holder  VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.banks IS 'Data rekening bank organisasi untuk keuangan';

-- ----------------------------------------------------------------------------
-- 2. TABEL CASH_ACCOUNTS (Data kas tunai organisasi)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cash_accounts IS 'Data kas tunai organisasi untuk keuangan';

-- ----------------------------------------------------------------------------
-- 3. TABEL WALLETS (Dompet dalam satu Bank/Kas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    bank_id         UUID REFERENCES public.banks(id) ON DELETE CASCADE,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE CASCADE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallets_owner_check CHECK (
        (bank_id IS NOT NULL AND cash_account_id IS NULL)
        OR (bank_id IS NULL AND cash_account_id IS NOT NULL)
    )
);

COMMENT ON TABLE public.wallets IS 'Dompet/dompet digital dalam satu rekening bank atau kas tunai';

-- ----------------------------------------------------------------------------
-- 4. ALTER FINANCES: tambahkan wallet_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 5. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wallets_bank ON public.wallets(bank_id);
CREATE INDEX IF NOT EXISTS idx_wallets_cash ON public.wallets(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_finances_wallet ON public.finances(wallet_id);

-- ----------------------------------------------------------------------------
-- 6. RLS: Enable RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. RLS POLICIES: Banks
-- ----------------------------------------------------------------------------
CREATE POLICY "banks_select_all"
    ON public.banks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "banks_manage_admin"
    ON public.banks FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- 8. RLS POLICIES: Cash Accounts
-- ----------------------------------------------------------------------------
CREATE POLICY "cash_accounts_select_all"
    ON public.cash_accounts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "cash_accounts_manage_admin"
    ON public.cash_accounts FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- 9. RLS POLICIES: Wallets
-- ----------------------------------------------------------------------------
CREATE POLICY "wallets_select_all"
    ON public.wallets FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "wallets_manage_admin"
    ON public.wallets FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- 10. TRIGGER: Auto-update updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at_wallets()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_updated_at_banks ON public.banks;
CREATE TRIGGER set_updated_at_banks
    BEFORE UPDATE ON public.banks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_wallets();

DROP TRIGGER IF EXISTS set_updated_at_cash_accounts ON public.cash_accounts;
CREATE TRIGGER set_updated_at_cash_accounts
    BEFORE UPDATE ON public.cash_accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_wallets();

DROP TRIGGER IF EXISTS set_updated_at_wallets ON public.wallets;
CREATE TRIGGER set_updated_at_wallets
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_wallets();
