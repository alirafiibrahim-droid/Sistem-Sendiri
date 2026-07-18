-- ============================================================================
-- SIORG - MODUL A12: INVENTARISASI (Asset & Inventory Management)
-- Jalankan seluruh SQL ini di Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE public.inventory_item_category AS ENUM ('ELECTRONICS', 'FURNITURE', 'STATIONERY', 'DOCUMENTS', 'OTHER');
CREATE TYPE public.inventory_item_condition AS ENUM ('GOOD', 'DAMAGED_LIGHT', 'DAMAGED_HEAVY', 'LOST');
CREATE TYPE public.inventory_loan_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'OVERDUE');
CREATE TYPE public.inventory_damage_type AS ENUM ('DAMAGE', 'LOSS', 'MAINTENANCE');


-- ============================================================================
-- 2. TABEL
-- ============================================================================

-- A12: INVENTORY ITEMS (Barang milik organisasi)
CREATE TABLE public.inventory_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    category        public.inventory_item_category NOT NULL DEFAULT 'OTHER',
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    condition       public.inventory_item_condition NOT NULL DEFAULT 'GOOD',
    location        VARCHAR(100) NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    photo_url       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_items IS 'Barang milik organisasi - inventarisasi (A12)';

-- A12: INVENTORY LOANS (Peminjaman barang)
CREATE TABLE public.inventory_loans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    borrower_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    borrow_date     DATE NOT NULL,
    return_date     DATE NOT NULL,
    actual_return   DATE,
    purpose         TEXT NOT NULL DEFAULT '',
    status          public.inventory_loan_status NOT NULL DEFAULT 'PENDING',
    approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    return_condition public.inventory_item_condition,
    return_notes    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_loan_dates CHECK (return_date >= borrow_date)
);

COMMENT ON TABLE public.inventory_loans IS 'Peminjaman barang inventaris (A12)';

-- A12: INVENTORY DAMAGE LOGS (Log kerusakan/kehilangan/pemeliharaan)
CREATE TABLE public.inventory_damage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    reported_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_date   DATE NOT NULL,
    type            public.inventory_damage_type NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    estimated_cost  NUMERIC(12,2) DEFAULT 0 CHECK (estimated_cost >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_damage_logs IS 'Log kerusakan/kehilangan/pemeliharaan barang inventaris (A12)';


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_inventory_items_code ON public.inventory_items(code);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX idx_inventory_items_condition ON public.inventory_items(condition);
CREATE INDEX idx_inventory_items_is_active ON public.inventory_items(is_active);

CREATE INDEX idx_inventory_loans_item ON public.inventory_loans(item_id);
CREATE INDEX idx_inventory_loans_borrower ON public.inventory_loans(borrower_id);
CREATE INDEX idx_inventory_loans_status ON public.inventory_loans(status);
CREATE INDEX idx_inventory_loans_return_date ON public.inventory_loans(return_date);

CREATE INDEX idx_inventory_damage_logs_item ON public.inventory_damage_logs(item_id);
CREATE INDEX idx_inventory_damage_logs_type ON public.inventory_damage_logs(type);


-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_damage_logs ENABLE ROW LEVEL SECURITY;

-- RLS: INVENTORY ITEMS
CREATE POLICY "inventory_items_select_all"
    ON public.inventory_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_items_insert_core"
    ON public.inventory_items FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "inventory_items_update_core"
    ON public.inventory_items FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "inventory_items_delete_admin"
    ON public.inventory_items FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- RLS: INVENTORY LOANS
CREATE POLICY "inventory_loans_select_all"
    ON public.inventory_loans FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_loans_insert_authenticated"
    ON public.inventory_loans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "inventory_loans_update_core"
    ON public.inventory_loans FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- RLS: INVENTORY DAMAGE LOGS
CREATE POLICY "inventory_damage_logs_select_all"
    ON public.inventory_damage_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_damage_logs_insert_core"
    ON public.inventory_damage_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );


-- ============================================================================
-- 5. TRIGGERS (auto-update updated_at)
-- ============================================================================

-- Fungsi handle_updated_at sudah ada dari modul lain.
-- Jika belum ada, uncomment block berikut:
-- CREATE OR REPLACE FUNCTION public.handle_updated_at()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     NEW.updated_at = now();
--     RETURN NEW;
-- END;
-- $$;

CREATE TRIGGER set_updated_at_inventory_items
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory_loans
    BEFORE UPDATE ON public.inventory_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 6. FUNGSI HELPER: Auto-generate kode barang (BRG-XXXX)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_inventory_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_num INTEGER;
    new_code VARCHAR(10);
BEGIN
    -- Ambil nomor terakhir dari kode yang ada
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(code FROM 5 FOR 4) AS INTEGER)),
        0
    ) + 1
    INTO next_num
    FROM public.inventory_items;

    -- Format kode: BRG-0001, BRG-0002, dst.
    new_code := 'BRG-' || LPAD(next_num::TEXT, 4, '0');
    NEW.code := new_code;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_inventory_code
    BEFORE INSERT ON public.inventory_items
    FOR EACH ROW
    WHEN (NEW.code IS NULL OR NEW.code = '')
    EXECUTE FUNCTION public.generate_inventory_code();


-- ============================================================================
-- 7. FUNGSI HELPER: Hitung stok tersedia
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_available_stock(p_item_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT
        i.stock - COALESCE(
            (SELECT SUM(l.quantity)
             FROM public.inventory_loans l
             WHERE l.item_id = p_item_id
               AND l.status IN ('APPROVED', 'OVERDUE')),
            0
        )::INTEGER
    FROM public.inventory_items i
    WHERE i.id = p_item_id;
$$;


-- ============================================================================
-- 8. SEED DATA (Contoh data untuk testing)
-- ============================================================================

INSERT INTO public.inventory_items (code, name, category, stock, condition, location, description)
VALUES
    ('BRG-0001', 'Laptop ASUS VivoBook 14', 'ELECTRONICS', 3, 'GOOD', 'Ruang Sekretariat', 'Laptop untuk keperluan administrasi organisasi'),
    ('BRG-0002', 'Proyektor Epson EB-X51', 'ELECTRONICS', 2, 'GOOD', 'Ruang Rapat', 'Proyektor portable untuk presentasi kegiatan'),
    ('BRG-0003', 'Meja Lipat 120x60cm', 'FURNITURE', 10, 'GOOD', 'Gudang Lantai 1', 'Meja lipat untuk acara seminar dan pelatihan'),
    ('BRG-0004', 'Kursi Lipat Plastik', 'FURNITURE', 50, 'GOOD', 'Gudang Lantai 1', 'Kursi lipat untuk peserta kegiatan'),
    ('BRG-0005', 'Speaker JBL PartyBox 310', 'ELECTRONICS', 2, 'DAMAGED_LIGHT', 'Ruang Sekretariat', 'Speaker portable untuk acara indoor/outdoor'),
    ('BRG-0006', 'Tinta Printer Canon 881', 'STATIONERY', 5, 'GOOD', 'Ruang Sekretariat', 'Tinta printer untuk keperluan cetak dokumen'),
    ('BRG-0007', 'Kertas HVS A4 80gr (Rim)', 'STATIONERY', 15, 'GOOD', 'Ruang Sekretariat', 'Kertas HVS untuk cetak proposal dan LPJ'),
    ('BRG-0008', 'Papan Tulis Whiteboard 120x240cm', 'FURNITURE', 1, 'GOOD', 'Ruang Rapat', 'Papan tulis untuk rapat dan koordinasi'),
    ('BRG-0009', 'Sound System TOA ZS-1030', 'ELECTRONICS', 1, 'DAMAGED_HEAVY', 'Gudang Lantai 2', 'Sistem pengeras suara untuk acara outdoor'),
    ('BRG-0010', 'Map Arsip Doccufill', 'DOCUMENTS', 20, 'GOOD', 'Ruang Sekretariat', 'Map arsip untuk penyimpanan dokumen fisik');
