-- ============================================================================
-- SIORG — MASTER MIGRATION SCRIPT
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- FASE 0: Foundation (tabel baru yang tidak ada di schema.sql)
-- ============================================================================

-- 0a. settings-fakultas-jurusan
CREATE TABLE IF NOT EXISTS public.fakultas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.jurusan (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    fakultas_id UUID REFERENCES public.fakultas(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fakultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurusan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fakultas_select_all" ON public.fakultas;
CREATE POLICY "fakultas_select_all" ON public.fakultas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "jurusan_select_all" ON public.jurusan;
CREATE POLICY "jurusan_select_all" ON public.jurusan FOR SELECT TO authenticated USING (true);

-- 0b. banks-cash-wallets (tabel)
CREATE TABLE IF NOT EXISTS public.banks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    account_number  VARCHAR(50) NOT NULL,
    account_holder  VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cash_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wallets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    bank_id         UUID REFERENCES public.banks(id) ON DELETE CASCADE,
    cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE CASCADE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "banks_select_all" ON public.banks;
CREATE POLICY "banks_select_all" ON public.banks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cash_accounts_select_all" ON public.cash_accounts;
CREATE POLICY "cash_accounts_select_all" ON public.cash_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "wallets_select_all" ON public.wallets;
CREATE POLICY "wallets_select_all" ON public.wallets FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- FASE 1: Schema Inti (schema.sql)
-- Jalankan schema.sql di sini jika belum pernah
-- ============================================================================
-- -- COPY PASTE isi schema.sql ke sini, lalu jalankan
-- ============================================================================

-- ============================================================================
-- FASE 2: ALTER tambahan (wajib setelah schema.sql)
-- ============================================================================

-- 2a. Tambah kolom wallet_id/bank_id/cash_account_id ke finances (dari banks-cash-wallets)
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL;
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS cash_account_id UUID REFERENCES public.cash_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finances_wallet ON public.finances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_finances_bank ON public.finances(bank_id);
CREATE INDEX IF NOT EXISTS idx_finances_cash ON public.finances(cash_account_id);

-- 2b. Tambah project_id ke finances
ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.incidental_projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finances_project ON public.finances(project_id);

-- 2c. Tambah fakultas_id/jurusan_id ke profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fakultas_id UUID REFERENCES public.fakultas(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jurusan_id UUID REFERENCES public.jurusan(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_fakultas ON public.profiles(fakultas_id);
CREATE INDEX IF NOT EXISTS idx_profiles_jurusan ON public.profiles(jurusan_id);

-- 2d. Fix FK finances.created_by → profiles (bukan auth.users)
DELETE FROM public.finances WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
ALTER TABLE public.finances DROP CONSTRAINT IF EXISTS finances_created_by_fkey;
ALTER TABLE public.finances ADD CONSTRAINT finances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2e. Fix FK achievements → profiles
DELETE FROM public.achievements WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_created_by_fkey;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
DELETE FROM public.achievement_participants WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);
ALTER TABLE public.achievement_participants DROP CONSTRAINT IF EXISTS achievement_participants_user_id_fkey;
ALTER TABLE public.achievement_participants ADD CONSTRAINT achievement_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2f. Update achievement_participants: ganti role_in_achievement → juara
ALTER TABLE public.achievement_participants DROP COLUMN IF EXISTS role_in_achievement;
ALTER TABLE public.achievement_participants ADD COLUMN IF NOT EXISTS juara VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE public.achievement_participants ADD COLUMN IF NOT EXISTS keterangan TEXT;

-- 2g. Fix letters.document_url default
ALTER TABLE public.letters ALTER COLUMN document_url SET DEFAULT '';

-- ============================================================================
-- FASE 3: RLS Policies tambahan
-- ============================================================================

-- 3a. RLS finances: INSERT untuk semua role
DROP POLICY IF EXISTS "finances_insert_admin_core" ON public.finances;
DROP POLICY IF EXISTS "finances_insert_all_roles" ON public.finances;
CREATE POLICY "finances_insert_all_roles" ON public.finances FOR INSERT TO authenticated WITH CHECK (true);

-- 3b. RLS programs: INSERT untuk semua role
DROP POLICY IF EXISTS "programs_insert_admin_core_kabid" ON public.programs;
DROP POLICY IF EXISTS "programs_insert_authenticated" ON public.programs;
CREATE POLICY "programs_insert_authenticated" ON public.programs FOR INSERT TO authenticated WITH CHECK (true);

-- 3c. RLS letters: SELECT policy
DROP POLICY IF EXISTS "letters_select_all" ON public.letters;
CREATE POLICY "letters_select_all" ON public.letters FOR SELECT TO authenticated USING (
    classification = 'PUBLIC'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    OR created_by = auth.uid()
);

-- 3d. RLS achievement_participants
DROP POLICY IF EXISTS "achievement_participants_select_all" ON public.achievement_participants;
DROP POLICY IF EXISTS "achievement_participants_insert_auth" ON public.achievement_participants;
DROP POLICY IF EXISTS "achievement_participants_delete_core" ON public.achievement_participants;
CREATE POLICY "achievement_participants_select_all" ON public.achievement_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "achievement_participants_insert_auth" ON public.achievement_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "achievement_participants_delete_core" ON public.achievement_participants FOR DELETE TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'PENGURUS_INTI')
);

-- ============================================================================
-- FASE 4: Role Enum tambahan
-- ============================================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'KETUA_UMUM' BEFORE 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'WAKIL_KETUA' BEFORE 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SEKRETARIS' AFTER 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'BENDAHARA' AFTER 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PELATIH' AFTER 'KABID';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'PEMBINA' AFTER 'KABID';

-- ============================================================================
-- FASE 5: Storage & lainnya
-- ============================================================================

-- 5a. Avatar bucket: hapus size limit
UPDATE storage.buckets SET file_size_limit = NULL WHERE id = 'avatars';

-- 5b. Notify Supabase auto schema cache
NOTIFY pgrst, 'reload schema';
