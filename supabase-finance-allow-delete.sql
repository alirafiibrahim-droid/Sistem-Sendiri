-- ============================================================================
-- SIORG Migration: Hapus Transaksi Keuangan + Kolom Source (A4)
-- ----------------------------------------------------------------------------
-- Aturan baru untuk modul Keuangan:
--   * Transaksi MANUAL yang dicatat via '+ Catat Transaksi' di modul Keuangan
--     (source = 'keuangan') boleh di-EDIT dan di-HAPUS dari modul Keuangan.
--   * Transaksi yang dibuat OTOMATIS oleh modul lain (source = 'inventory'
--     untuk Pembelian Inventori, 'dues' untuk iuran) TIDAK boleh di-edit
--     maupun di-hapus dari modul Keuangan; dikelola di modul asalnya.
--
-- Perubahan:
--   1. Kolom finances.source (default 'keuangan')
--   2. Backfill data lama berdasarkan keterkaitan yang ada
--   3. Trigger delete kini hanya memblokir transaksi non-keuangan
--   4. Trigger iuran kini menulis source = 'dues'
--
-- JALANKAN di Supabase SQL Editor.
-- ============================================================================

-- 1. Kolom asal transaksi
ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'keuangan';

-- 2. Backfill data lama
UPDATE public.finances f
SET source = 'inventory'
WHERE EXISTS (
    SELECT 1 FROM public.inventory_purchases ip WHERE ip.finance_id = f.id
);

UPDATE public.finances
SET source = 'dues'
WHERE description LIKE 'Pelunasan Iuran:%'
   OR receipt_url = 'system_verified';

COMMENT ON COLUMN public.finances.source
    IS 'Asal transaksi: keuangan (manual), inventory (pembelian inventori), dues (iuran)';

-- 3. Trigger proteksi jurnal: DELETE hanya untuk transaksi manual (source='keuangan')
CREATE OR REPLACE FUNCTION public.protect_finances_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.source IS DISTINCT FROM 'keuangan' THEN
        RAISE EXCEPTION
            'Transaksi berasal dari modul lain dan hanya dapat dihapus di modul asalnya.';
    END IF;
    RETURN OLD;
END;
$$;

-- 4. Trigger iuran: tandai transaksi dari modul iuran
CREATE OR REPLACE FUNCTION public.log_paid_dues_to_finances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_title       VARCHAR;
    v_amount      NUMERIC;
    v_member_name VARCHAR;
BEGIN
    IF (new.status = 'PAID'::public.dues_payment_status
        AND old.status <> 'PAID'::public.dues_payment_status)
    THEN
        SELECT title, amount INTO v_title, v_amount
        FROM public.dues_templates WHERE id = new.due_template_id;

        SELECT full_name INTO v_member_name
        FROM public.profiles WHERE id = new.user_id;

        INSERT INTO public.finances (type, amount, description, date, receipt_url, created_by, source)
        VALUES (
            'INCOME'::public.finance_type,
            v_amount,
            'Pelunasan Iuran: ' || v_member_name || ' - ' || v_title,
            CURRENT_DATE,
            COALESCE(new.proof_url, 'system_verified'),
            new.verified_by,
            'dues'
        );
    END IF;
    RETURN NEW;
END;
$$;
