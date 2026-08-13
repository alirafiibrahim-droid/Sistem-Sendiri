-- ============================================================================
-- SIORG DATABASE SCHEMA & SYSTEM DDL
-- Target Engine: PostgreSQL / Supabase (apnlpdtgurvbdfkyzoxg.supabase.co)
--
-- Sumber: PRD A2 (Auth), A3 (Keatletan), A4 (Keuangan), A5 (Manajemen Anggota),
--         A6 (Pengaturan), A7 (Persuratan), A8 (Prestasi), A9 (Program Kerja),
--         A10 (Proyek Insidental), A11 (Sertijab)
--
-- Catatan Supabase:
--   - Tabel auth.users dikelola oleh Supabase Auth (managed service)
--   - auth.uid() mengembalikan UUID pengguna yang sedang login (RLS context)
--   - auth.role() mengembalikan 'anon', 'authenticated', atau 'service_role'
--   - Gunakan `TO authenticated` pada RLS untuk pengguna terautentikasi
--   - Gunakan `SECURITY DEFINER` pada function yang perlu akses tinggi
--   - Supabase Storage untuk file (avatars, receipts, documents, dll)
-- ============================================================================


-- ============================================================================
-- BAGIAN 0: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;


-- ============================================================================
-- BAGIAN 1: CUSTOM ENUM TYPES
-- ============================================================================

-- A2 & A5: Role & Status pengguna
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'KETUA_UMUM', 'WAKIL_KETUA', 'PENGURUS_INTI', 'SEKRETARIS', 'BENDAHARA', 'KABID', 'PELATIH', 'PEMBINA', 'ANGGOTA');
CREATE TYPE public.user_status AS ENUM ('AKTIF', 'CUTI', 'ALUMNI', 'NONAKTIF');

-- A9: Status program kerja
CREATE TYPE public.program_status AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- A4: Tipe transaksi keuangan
CREATE TYPE public.finance_type AS ENUM ('INCOME', 'EXPENSE');

-- A9: Status & prioritas tugas
CREATE TYPE public.task_status AS ENUM ('TO_DO', 'IN_PROGRESS', 'DONE');
CREATE TYPE public.task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Presensi
CREATE TYPE public.attendance_status AS ENUM ('PRESENT', 'ABSENT', 'SICK', 'PERMIT');

-- A4: Status pembayaran iuran
CREATE TYPE public.dues_payment_status AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'PAID');

-- A7: Tipe & kerahasiaan surat
CREATE TYPE public.letter_type AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE public.letter_classification AS ENUM ('PUBLIC', 'CONFIDENTIAL');

-- A11: Status sertijab (NOT_STARTED=Belum Berjalan, ONGOING=Berjalan, COMPLETED=Selesai Periode)
CREATE TYPE public.handover_status AS ENUM ('NOT_STARTED', 'ONGOING', 'COMPLETED');

-- A3: Tipe metrik keatletan & intensitas latihan
CREATE TYPE public.metric_type AS ENUM ('QUANTITATIVE', 'QUALITATIVE');
CREATE TYPE public.intensity_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE public.training_category AS ENUM (
  'STRENGTH', 'POWER', 'SPEED', 'AGILITY',
  'ENDURANCE', 'FLEXIBILITY', 'TEKNIK', 'MENTAL', 'GAME_INTELLIGENCE'
);
CREATE TYPE public.attendance_method AS ENUM ('MANUAL', 'QR');

-- A8: Tipe & status prestasi
CREATE TYPE public.achievement_type AS ENUM ('ORGANIZATION', 'INDIVIDUAL');
CREATE TYPE public.achievement_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.achievement_juara AS ENUM ('JUARA_I', 'JUARA_II', 'JUARA_III', 'JUARA_HARAPAN');

-- A10: Status proyek insidental
CREATE TYPE public.project_status AS ENUM ('PROPOSED', 'APPROVED', 'ONGOING', 'CLOSED');

-- A12: Inventarisasi
CREATE TYPE public.inventory_item_category AS ENUM ('ELECTRONICS', 'FURNITURE', 'STATIONERY', 'DOCUMENTS', 'OTHER');
CREATE TYPE public.inventory_item_condition AS ENUM ('GOOD', 'DAMAGED_LIGHT', 'DAMAGED_HEAVY', 'LOST');
CREATE TYPE public.inventory_loan_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'OVERDUE');
CREATE TYPE public.inventory_damage_type AS ENUM ('DAMAGE', 'LOSS', 'MAINTENANCE');


-- ============================================================================
-- BAGIAN 2: TABEL INTI (SHARED / FOUNDATIONAL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A5 & A6: DIVISIONS (Daftar divisi/bidang organisasi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.divisions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.divisions IS 'Daftar divisi/bidang dalam organisasi (A5, A6)';

-- ----------------------------------------------------------------------------
-- A2 & A5: PROFILES (Profil pengguna, terhubung ke auth.users via trigger)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        VARCHAR(255) UNIQUE NOT NULL,
    full_name    VARCHAR(255) NOT NULL,
    nim          VARCHAR(15) UNIQUE NOT NULL,
    role         public.user_role NOT NULL DEFAULT 'ANGGOTA',
    division_id  UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
    phone_number VARCHAR(20),
    status       public.user_status NOT NULL DEFAULT 'AKTIF',
    avatar_url   TEXT,
    theme        VARCHAR(50) NOT NULL DEFAULT 'default',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Profil metadata pengguna, terintegrasi dengan Supabase Auth (A2, A5)';

-- ----------------------------------------------------------------------------
-- A6: ORGANIZATION SETTINGS (Pengaturan global organisasi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.organization_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name        VARCHAR(100) NOT NULL DEFAULT 'SIORG',
    org_description TEXT NOT NULL DEFAULT '',
    org_email       VARCHAR(255),
    org_logo_url    TEXT,
    period_year     VARCHAR(9) NOT NULL DEFAULT '2025/2026', -- Format: YYYY/YYYY
    is_maintenance  BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_settings IS 'Pengaturan global organisasi (A6)';

-- ----------------------------------------------------------------------------
-- A6: AUDIT LOGS (Jejak audit perubahan data sensitif)
-- ----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    target_table VARCHAR(50),
    target_id    UUID,
    old_value    JSONB,
    new_value    JSONB,
    ip_address   INET,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Jejak audit perubahan data sensitif untuk forensik (A6)';


-- ============================================================================
-- BAGIAN 3: MODUL PROGRAM KERJA (A9)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A9: PROGRAMS (Program Kerja / Proker)
-- ----------------------------------------------------------------------------
CREATE TABLE public.programs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    budget_estimate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (budget_estimate >= 0),
    status          public.program_status NOT NULL DEFAULT 'PLANNED',
    proposal_url    TEXT,
    lpj_url         TEXT,
    division_id     UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_program_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.programs IS 'Daftar program kerja organisasi (A9)';

-- ----------------------------------------------------------------------------
-- A9: PROGRAM MEMBERS (Kepanitiaan program kerja)
-- ----------------------------------------------------------------------------
CREATE TABLE public.program_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_in_program VARCHAR(100) NOT NULL,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(program_id, user_id)
);

COMMENT ON TABLE public.program_members IS 'Struktur kepanitiaan program kerja (A9)';

-- ----------------------------------------------------------------------------
-- A9: TASKS (Tugas Kanban Board)
-- ----------------------------------------------------------------------------
CREATE TABLE public.tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    title       VARCHAR(80) NOT NULL,
    description TEXT,
    status      public.task_status NOT NULL DEFAULT 'TO_DO',
    priority    public.task_priority NOT NULL DEFAULT 'MEDIUM',
    due_date    DATE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tasks IS 'Tugas-tugas pada program kerja / Kanban Board (A9)';


-- ============================================================================
-- BAGIAN 4: MODUL KEUANGAN (A4)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A4: FINANCES (Buku besar kas / Jurnal transaksi)
--     source: 'keuangan' (manual via '+ Catat Transaksi'),
--             'inventory' (pembelian inventori), 'dues' (iuran).
--     Transaksi dengan source != 'keuangan' hanya dapat diubah/dihapus
--     di modul asalnya.
-- ----------------------------------------------------------------------------
CREATE TABLE public.finances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        public.finance_type NOT NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    date        DATE NOT NULL,
    program_id  UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    project_id  UUID REFERENCES public.incidental_projects(id) ON DELETE SET NULL,
    handover_id UUID REFERENCES public.handovers(id) ON DELETE SET NULL,
    receipt_url TEXT NOT NULL,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    source      TEXT NOT NULL DEFAULT 'keuangan'
);

COMMENT ON TABLE public.finances IS 'Jurnal transaksi keuangan (A4)';
COMMENT ON COLUMN public.finances.source
    IS 'Asal transaksi: keuangan (manual), inventory (pembelian inventori), dues (iuran)';
COMMENT ON COLUMN public.finances.handover_id
    IS 'Periode Sertijab (kepengurusan) tempat transaksi dicatat (Periode Berjalan)';

-- ----------------------------------------------------------------------------
-- A4: DUES TEMPLATES (Template tagihan iuran bulanan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.dues_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    due_date    DATE NOT NULL,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dues_templates IS 'Template/definisi tagihan iuran bulanan anggota (A4)';

-- ----------------------------------------------------------------------------
-- A4: DUES PAYMENTS (Status pembayaran iuran per anggota)
-- ----------------------------------------------------------------------------
CREATE TABLE public.dues_payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    due_template_id   UUID NOT NULL REFERENCES public.dues_templates(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status            public.dues_payment_status NOT NULL DEFAULT 'UNPAID',
    payment_date      DATE,
    proof_url         TEXT,
    feedback          TEXT,
    verified_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(due_template_id, user_id)
);

COMMENT ON TABLE public.dues_payments IS 'Status pembayaran iuran per anggota (A4)';


-- ============================================================================
-- BAGIAN 5: MODUL MANAJEMEN ANGOTA (A5)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ATTENDANCES (Presensi kehadiran anggota di program kerja)
-- ----------------------------------------------------------------------------
CREATE TABLE public.attendances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status      public.attendance_status NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(program_id, user_id, (timestamp::date))
);

COMMENT ON TABLE public.attendances IS 'Rekam jejak kehadiran anggota di program kerja (A5)';


-- ============================================================================
-- BAGIAN 6: MODUL PERSURATAN (A7)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A7: LETTERS (Arsip surat masuk & keluar)
-- ----------------------------------------------------------------------------
CREATE TABLE public.letters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                public.letter_type NOT NULL,
    reference_number    VARCHAR(100) UNIQUE NOT NULL,
    title               VARCHAR(255) NOT NULL,
    sender              VARCHAR(255) NOT NULL,
    date_received_sent  DATE NOT NULL,
    classification      public.letter_classification NOT NULL DEFAULT 'PUBLIC',
    document_url        TEXT NOT NULL,
    handover_id         UUID REFERENCES public.handovers(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.letters IS 'Katalog arsip surat masuk & keluar dengan level kerahasiaan (A7)';

CREATE INDEX idx_letters_handover ON public.letters(handover_id);


-- ============================================================================
-- BAGIAN 7: MODUL SERAH TERIMA JABATAN / SERTIJAB (A7, A11)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A7 & A11: HANDOVERS (Serah Terima Jabatan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.handovers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_from     VARCHAR(9) NOT NULL,    -- Format: 'YYYY/YYYY'
    period_to       VARCHAR(9) NOT NULL,
    handover_date   DATE NOT NULL,
    document_url    TEXT,
    witnesses       JSONB NOT NULL DEFAULT '[]'::jsonb,
    status          public.handover_status NOT NULL DEFAULT 'NOT_STARTED',
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.handovers IS 'Data serah terima jabatan antar periode kepengurusan (A7, A11)';


-- ============================================================================
-- BAGIAN 8: MODUL KEATLETAN (A3)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A3: ATHLETIC METRICS (Definisi metrik kemampuan atlet)
-- ----------------------------------------------------------------------------
CREATE TABLE public.athletic_metrics (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    type       public.metric_type NOT NULL,
    unit       VARCHAR(20),
    category   public.training_category,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.athletic_metrics IS 'Definisi metrik kemampuan atlet (A3)';

-- ----------------------------------------------------------------------------
-- A3: TRAININGS (Master data latihan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.trainings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    category   public.training_category NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trainings IS 'Master data latihan — nama + kategori (A3)';

-- ----------------------------------------------------------------------------
-- A3: ATHLETE-COACH MAPPING (Relasi pelatih-atlet)
-- ----------------------------------------------------------------------------
CREATE TABLE public.athlete_coach_mapping (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(coach_id, athlete_id)
);

COMMENT ON TABLE public.athlete_coach_mapping IS 'Mapping relasi pelatih dengan atlet bimbingannya (A3)';

-- ----------------------------------------------------------------------------
-- A3: TRAINING SESSIONS (Log sesi latihan harian)
-- ----------------------------------------------------------------------------
CREATE TABLE public.training_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    training_id      UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
    name             VARCHAR(100),
    date             DATE NOT NULL,
    session_code     VARCHAR(7) UNIQUE,
    session_type     VARCHAR(50),
    duration_minutes INTEGER,
    intensity        public.intensity_level,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.training_sessions IS 'Log pencatatan sesi latihan harian (A3)';

-- ----------------------------------------------------------------------------
-- A3: TRAINING SESSION TRAININGS (Banyak latihan/variabel dalam satu sesi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.training_session_trainings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, training_id)
);

COMMENT ON TABLE public.training_session_trainings
    IS 'Relasi sesi latihan dengan banyak latihan (variabel penilaian) (A3)';

CREATE INDEX idx_ts_trainings_session
    ON public.training_session_trainings(session_id);
CREATE INDEX idx_ts_trainings_training
    ON public.training_session_trainings(training_id);

-- ----------------------------------------------------------------------------
-- A3: TRAINING SESSION ATTENDANTS (Kehadiran atlet dalam sesi latihan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.training_session_attendants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method     public.attendance_method NOT NULL DEFAULT 'MANUAL',
    scanned_at TIMESTAMPTZ,
    UNIQUE(session_id, athlete_id)
);

COMMENT ON TABLE public.training_session_attendants IS 'Daftar kehadiran atlet dalam sesi latihan (A3)';

-- ----------------------------------------------------------------------------
-- A3: ASSESSMENTS (Hasil penilaian hybrid atlet)
-- ----------------------------------------------------------------------------
CREATE TABLE public.assessments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
    athlete_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_id   UUID NOT NULL REFERENCES public.athletic_metrics(id) ON DELETE CASCADE,
    value       NUMERIC NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessments IS 'Hasil penilaian hybrid (kuantitatif & kualitatif) atlet (A3)';

-- ----------------------------------------------------------------------------
-- A3: ATHLETE TARGETS (Target performa yang ditetapkan untuk setiap atlet)
-- ----------------------------------------------------------------------------
CREATE TABLE public.athlete_targets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_id     UUID NOT NULL REFERENCES public.athletic_metrics(id) ON DELETE CASCADE,
    target_value  NUMERIC NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(athlete_id, metric_id)
);

COMMENT ON TABLE public.athlete_targets IS 'Target performa yang ditetapkan untuk setiap atlet (A3)';


-- ============================================================================
-- BAGIAN 9: MODUL PRESTASI (A8)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A8: ACHIEVEMENTS (Data prestasi organisasi & individu)
-- ----------------------------------------------------------------------------
CREATE TABLE public.achievements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    type              public.achievement_type NOT NULL,
    category          VARCHAR(50) NOT NULL,
    level             VARCHAR(50) NOT NULL,
    organizer         VARCHAR(255),
    achievement_date  DATE NOT NULL,
    juara             public.achievement_juara,
    proof_url         TEXT,
    status            public.achievement_status NOT NULL DEFAULT 'PENDING',
    rejection_reason  TEXT,
    handover_id       UUID REFERENCES public.handovers(id) ON DELETE SET NULL,
    created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.achievements IS 'Data prestasi organisasi & individu / Wall of Fame (A8)';

CREATE INDEX idx_achievements_handover ON public.achievements(handover_id);

-- ----------------------------------------------------------------------------
-- A8: ACHIEVEMENT PARTICIPANTS (Peserta/anggota yang terlibat dalam prestasi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.achievement_participants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_id      UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    juara               public.achievement_juara,
    keterangan          TEXT,
    UNIQUE(achievement_id, user_id)
);

COMMENT ON TABLE public.achievement_participants IS 'Peserta/anggota yang terlibat dalam pencapaian prestasi (A8)';


-- ============================================================================
-- BAGIAN 10: MODUL PROYEK INSIDENTAL (A10)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A10: INCIDENTAL PROJECTS (Proyek ad-hoc/insidental)
-- ----------------------------------------------------------------------------
CREATE TABLE public.incidental_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    urgency_level   VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    start_date      DATE NOT NULL,
    end_date        DATE,
    budget_source   VARCHAR(255),
    status          public.project_status NOT NULL DEFAULT 'PROPOSED',
    handover_id     UUID REFERENCES public.handovers(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.incidental_projects IS 'Proyek ad-hoc/insidental di luar program kerja rutin (A10)';

CREATE INDEX idx_incidental_projects_handover ON public.incidental_projects(handover_id);

-- ----------------------------------------------------------------------------
-- A10: PROJECT FUNDS (Dana masuk/keluar proyek insidental)
-- ----------------------------------------------------------------------------
CREATE TABLE public.project_funds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    type        public.finance_type NOT NULL,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    source      VARCHAR(255),
    description TEXT,
    date        DATE NOT NULL,
    receipt_url TEXT,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_funds IS 'Pencatatan dana masuk/keluar proyek insidental (A10)';

-- ----------------------------------------------------------------------------
-- A10: PROJECT TEAM (Tim task force lintas divisi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.project_team (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_role  VARCHAR(100),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

COMMENT ON TABLE public.project_team IS 'Tim task force proyek insidental lintas divisi (A10)';

-- ----------------------------------------------------------------------------
-- A10: PROJECT MILESTONES (Milestone pelacakan proyek)
-- ----------------------------------------------------------------------------
CREATE TABLE public.project_milestones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    due_date      DATE,
    is_completed  BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_milestones IS 'Milestone/titik pencapaian proyek insidental (A10)';

-- ----------------------------------------------------------------------------
-- A9/A10: BUDGET ITEMS (Pos Anggaran Program Kerja & Proyek Insidental)
--     Anggaran dibuat melalui Detail Program/Proyek -> Tab Anggaran.
--     Induk Pos (parent_id IS NULL) dapat berisi nilai langsung atau menjadi
--     wadah untuk Anak Pos. Anak Pos (parent_id NOT NULL) menambah sub total.
--     Total Anggaran = SUM(subtotal) seluruh pos pada entity.
-- ----------------------------------------------------------------------------
CREATE TABLE public.budget_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID REFERENCES public.programs(id) ON DELETE CASCADE,
    project_id  UUID REFERENCES public.incidental_projects(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES public.budget_items(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    quantity    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_budget_items_owner CHECK (
        (program_id IS NOT NULL)::int + (project_id IS NOT NULL)::int = 1
    )
);

COMMENT ON TABLE public.budget_items IS 'Pos anggaran Program Kerja (A9) dan Proyek Insidental (A10)';

CREATE INDEX idx_budget_items_program ON public.budget_items(program_id);
CREATE INDEX idx_budget_items_project ON public.budget_items(project_id);
CREATE INDEX idx_budget_items_parent ON public.budget_items(parent_id);


-- ============================================================================
-- BAGIAN 10B: MODUL INVENTARISASI (A12)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A12: INVENTORY ITEMS (Barang milik organisasi)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: INVENTORY LOANS (Peminjaman barang)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: INVENTORY DAMAGE LOGS (Log kerusakan/kehilangan/pemeliharaan)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: INVENTORY PURCHASES (Pencatatan pembelian barang)
-- ----------------------------------------------------------------------------
CREATE TABLE public.inventory_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
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


-- ============================================================================
-- BAGIAN 11: INDEXES (Optimasi performa query)
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_nim ON public.profiles(nim);
CREATE INDEX idx_profiles_full_name ON public.profiles(full_name);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_division ON public.profiles(division_id);

-- Programs
CREATE INDEX idx_programs_status ON public.programs(status);
CREATE INDEX idx_programs_division ON public.programs(division_id);
CREATE INDEX idx_programs_created_by ON public.programs(created_by);

-- Tasks
CREATE INDEX idx_tasks_program_id ON public.tasks(program_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);

-- Finances
CREATE INDEX idx_finances_type ON public.finances(type);
CREATE INDEX idx_finances_date ON public.finances(date);
CREATE INDEX idx_finances_program ON public.finances(program_id);
CREATE INDEX idx_finances_handover ON public.finances(handover_id);

-- Dues
CREATE INDEX idx_dues_payments_user ON public.dues_payments(user_id);
CREATE INDEX idx_dues_payments_status ON public.dues_payments(status);

-- Letters
CREATE INDEX idx_letters_type ON public.letters(type);
CREATE INDEX idx_letters_classification ON public.letters(classification);
CREATE INDEX idx_letters_reference ON public.letters(reference_number);

-- Achievements
CREATE INDEX idx_achievements_type ON public.achievements(type);
CREATE INDEX idx_achievements_status ON public.achievements(status);
CREATE INDEX idx_achievements_category ON public.achievements(category);

-- Attendances
CREATE INDEX idx_attendances_program ON public.attendances(program_id);
CREATE INDEX idx_attendances_user ON public.attendances(user_id);

-- Handovers
CREATE INDEX idx_handovers_status ON public.handovers(status);

-- Assessments (A3)
CREATE INDEX idx_assessments_athlete ON public.assessments(athlete_id);
CREATE INDEX idx_assessments_metric ON public.assessments(metric_id);

-- Incidental Projects (A10)
CREATE INDEX idx_incidental_projects_status ON public.incidental_projects(status);

-- Inventory Items (A12)
CREATE INDEX idx_inventory_items_code ON public.inventory_items(code);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX idx_inventory_items_condition ON public.inventory_items(condition);
CREATE INDEX idx_inventory_items_is_active ON public.inventory_items(is_active);

-- Inventory Loans (A12)
CREATE INDEX idx_inventory_loans_item ON public.inventory_loans(item_id);
CREATE INDEX idx_inventory_loans_borrower ON public.inventory_loans(borrower_id);
CREATE INDEX idx_inventory_loans_status ON public.inventory_loans(status);
CREATE INDEX idx_inventory_loans_return_date ON public.inventory_loans(return_date);

-- Inventory Damage Logs (A12)
CREATE INDEX idx_inventory_damage_logs_item ON public.inventory_damage_logs(item_id);
CREATE INDEX idx_inventory_damage_logs_type ON public.inventory_damage_logs(type);

-- Inventory Purchases (A12)
CREATE INDEX idx_inventory_purchases_item ON public.inventory_purchases(item_id);
CREATE INDEX idx_inventory_purchases_date ON public.inventory_purchases(date);
CREATE INDEX idx_inventory_purchases_finance ON public.inventory_purchases(finance_id);

-- Audit Logs (A6)
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);


-- ============================================================================
-- BAGIAN 12: ROW LEVEL SECURITY (RLS) POLICIES
--
-- Supabase RLS Pattern:
--   TO authenticated  -> hanya pengguna yang sudah login
--   auth.uid()        -> UUID pengguna saat ini dari JWT
--   Subquery ke public.profiles untuk cek role
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Aktifkan RLS untuk semua tabel
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_session_attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidental_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_damage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- A5: RLS PROFILES
-- ----------------------------------------------------------------------------
-- Semua user terautentikasi bisa membaca profil
CREATE POLICY "profiles_select_all"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- User bisa update profil sendiri (field terbatas: phone, avatar, full_name)
CREATE POLICY "profiles_update_self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admin bisa update semua kolom di profil siapa saja
CREATE POLICY "profiles_admin_full_access"
    ON public.profiles FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ----------------------------------------------------------------------------
-- A9: RLS PROGRAMS
-- ----------------------------------------------------------------------------
CREATE POLICY "programs_select_all"
    ON public.programs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "programs_insert_authenticated"
    ON public.programs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "programs_update_admin_core"
    ON public.programs FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- A9: RLS PROGRAM MEMBERS
-- ----------------------------------------------------------------------------
CREATE POLICY "program_members_select_all"
    ON public.program_members FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "program_members_manage_core"
    ON public.program_members FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- A9: RLS TASKS (hanya anggota panitia bisa modifikasi)
-- ----------------------------------------------------------------------------
CREATE POLICY "tasks_select_all"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "tasks_insert_committee"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.program_members pm
            WHERE pm.program_id = NEW.program_id
              AND pm.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "tasks_update_committee"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.program_members pm
            WHERE pm.program_id = OLD.program_id
              AND pm.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- A4: RLS FINANCES (SELECT semua, INSERT semua, UPDATE untuk pengelola)
-- ----------------------------------------------------------------------------
CREATE POLICY "finances_select_all"
    ON public.finances FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "finances_insert_all_roles"
    ON public.finances FOR INSERT
    TO authenticated
    WITH CHECK (true);

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
-- DELETE dicegah oleh trigger immutable (bagian 15)

-- ----------------------------------------------------------------------------
-- A4: RLS DUES_TEMPLATES
-- ----------------------------------------------------------------------------
CREATE POLICY "dues_templates_select_all"
    ON public.dues_templates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "dues_templates_manage_admin_core"
    ON public.dues_templates FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- A4: RLS DUES_PAYMENTS
-- ----------------------------------------------------------------------------
-- Anggota lihat milik sendiri; Admin/Core lihat semua
CREATE POLICY "dues_payments_select_own_or_admin"
    ON public.dues_payments FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Anggota update bukti bayar sendiri (proof_url, payment_date, status -> PENDING)
CREATE POLICY "dues_payments_update_own_proof"
    ON public.dues_payments FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin/Core verifikasi (approve/reject)
CREATE POLICY "dues_payments_verify_admin"
    ON public.dues_payments FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- ----------------------------------------------------------------------------
-- A7: RLS LETTERS
-- ----------------------------------------------------------------------------
-- PUBLIC bisa dibaca semua; CONFIDENTIAL hanya admin/core/pembuat


CREATE POLICY "letters_insert_core"
    ON public.letters FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "letters_update_core"
    ON public.letters FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "letters_delete_admin"
    ON public.letters FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ----------------------------------------------------------------------------
-- A11: RLS HANDOVERS
-- ----------------------------------------------------------------------------
-- COMPLETED bisa dibaca semua; NOT_STARTED/ONGOING hanya admin/core
CREATE POLICY "handovers_select_access"
    ON public.handovers FOR SELECT
    TO authenticated
    USING (
        status = 'COMPLETED'
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "handovers_insert_core"
    ON public.handovers FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Hanya bisa update jika status belum COMPLETED
CREATE POLICY "handovers_update_not_completed"
    ON public.handovers FOR UPDATE
    TO authenticated
    USING (
        status != 'COMPLETED'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "handovers_delete_admin"
    ON public.handovers FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ----------------------------------------------------------------------------
-- A8: RLS ACHIEVEMENTS
-- ----------------------------------------------------------------------------
-- Semua bisa lihat APPROVED; pembuat & admin/core bisa lihat semua status
CREATE POLICY "achievements_select_access"
    ON public.achievements FOR SELECT
    TO authenticated
    USING (
        status = 'APPROVED'
        OR created_by = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Semua user terautentikasi bisa mengajukan prestasi (status = PENDING)
CREATE POLICY "achievements_insert_authenticated"
    ON public.achievements FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "achievements_update_core"
    ON public.achievements FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "achievements_delete_admin"
    ON public.achievements FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ----------------------------------------------------------------------------
-- A3: RLS KEATLETAN
-- ----------------------------------------------------------------------------
-- Semua user bisa lihat metrik
CREATE POLICY "athletic_metrics_select_all"
    ON public.athletic_metrics FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "athletic_metrics_manage_core"
    ON public.athletic_metrics FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Training sessions: semua bisa baca, pelatih/core/admin bisa tulis
CREATE POLICY "training_sessions_select_all"
    ON public.training_sessions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "training_sessions_insert_coach"
    ON public.training_sessions FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
        OR coach_id = auth.uid()
    );

-- Training session trainings: semua bisa baca, pelatih/core/admin bisa tulis
ALTER TABLE public.training_session_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_trainings_select_all"
    ON public.training_session_trainings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "ts_trainings_insert_coach"
    ON public.training_session_trainings FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
        OR EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.id = session_id
              AND ts.coach_id = auth.uid()
        )
    );

CREATE POLICY "ts_trainings_delete_coach"
    ON public.training_session_trainings FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
        OR EXISTS (
            SELECT 1 FROM public.training_sessions ts
            WHERE ts.id = session_id
              AND ts.coach_id = auth.uid()
        )
    );

-- Trainings: all authenticated can read, core/coach can manage
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainings_select_all"
    ON public.trainings FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "trainings_manage_core"
    ON public.trainings FOR ALL
    TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'PENGURUS_INTI', 'KABID', 'PELATIH')
        )
    );

-- Assessments: atlet lihat milik sendiri, coach lihat atlet bimbingan
CREATE POLICY "assessments_select_own_or_coach"
    ON public.assessments FOR SELECT
    TO authenticated
    USING (
        athlete_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = assessments.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'PELATIH', 'KABID')
    );

CREATE POLICY "assessments_insert_coach"
    ON public.assessments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.athlete_coach_mapping acm
            WHERE acm.coach_id = auth.uid()
              AND acm.athlete_id = assessments.athlete_id
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'PELATIH', 'KABID')
    );

-- Athlete targets: atlet lihat milik sendiri, coach/admin kelola
CREATE POLICY "athlete_targets_select_own_or_admin"
    ON public.athlete_targets FOR SELECT
    TO authenticated
    USING (
        athlete_id = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "athlete_targets_manage_core"
    ON public.athlete_targets FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Training session attendants: all auth read, insert own attendance or coach manage
CREATE POLICY "tsa_select_all"
    ON public.training_session_attendants FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "tsa_insert_own"
    ON public.training_session_attendants FOR INSERT
    TO authenticated
    WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "tsa_manage_core"
    ON public.training_session_attendants FOR ALL
    TO authenticated USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID', 'PELATIH')
    );

-- ----------------------------------------------------------------------------
-- A10: RLS PROYEK INSIDENTAL
-- ----------------------------------------------------------------------------
CREATE POLICY "incidental_projects_select_all"
    ON public.incidental_projects FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "incidental_projects_insert_core_kabid"
    ON public.incidental_projects FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "incidental_projects_update_core"
    ON public.incidental_projects FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Project team: semua bisa baca, core/admin kelola
CREATE POLICY "project_team_select_all"
    ON public.project_team FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "project_team_manage_core"
    ON public.project_team FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- Project funds: tim proyek & admin bisa baca/tulis
CREATE POLICY "project_funds_select_team_or_admin"
    ON public.project_funds FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_funds.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "project_funds_insert_team_or_admin"
    ON public.project_funds FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = NEW.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI')
    );

-- Project milestones: tim proyek & admin bisa baca/tulis
CREATE POLICY "project_milestones_select_all"
    ON public.project_milestones FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "project_milestones_manage_team"
    ON public.project_milestones FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.project_team pt
            WHERE pt.project_id = project_milestones.project_id
              AND pt.user_id = auth.uid()
        )
        OR (SELECT role FROM public.profiles WHERE id = auth.uid())
           IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- A9/A10: RLS BUDGET ITEMS
-- ----------------------------------------------------------------------------
CREATE POLICY "budget_items_select_all"
    ON public.budget_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "budget_items_insert_core"
    ON public.budget_items FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "budget_items_update_core"
    ON public.budget_items FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "budget_items_delete_core"
    ON public.budget_items FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

-- ----------------------------------------------------------------------------
-- A6: RLS AUDIT LOGS (hanya admin bisa membaca)
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_admin"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ----------------------------------------------------------------------------
-- A12: RLS INVENTORY ITEMS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: RLS INVENTORY LOANS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: RLS INVENTORY DAMAGE LOGS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- A12: RLS INVENTORY PURCHASES
-- ----------------------------------------------------------------------------
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


-- ============================================================================
-- BAGIAN 13: FUNCTIONS & TRIGGERS (Automation Engine)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A5: Trigger otomatis membuat profile saat user baru dibuat di auth.users
--     (Supabase Auth trigger pattern - SECURITY DEFINER diperlukan)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, nim, role, division_id, phone_number, status, fakultas_id, jurusan_id)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nama Pengguna'),
        COALESCE(new.raw_user_meta_data->>'nim', '00000000'),
        COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'ANGGOTA'::public.user_role),
        NULLIF(new.raw_user_meta_data->>'division_id', '')::UUID,
        new.raw_user_meta_data->>'phone_number',
        'AKTIF'::public.user_status,
        NULLIF(new.raw_user_meta_data->>'fakultas_id', '')::UUID,
        NULLIF(new.raw_user_meta_data->>'jurusan_id', '')::UUID
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- A4: Trigger otomatis buat tagihan UNPAID saat template iuran dibuat
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_dues_for_active_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.dues_payments (due_template_id, user_id, status)
    SELECT new.id, p.id, 'UNPAID'::public.dues_payment_status
    FROM public.profiles p
    WHERE p.status = 'AKTIF'::public.user_status
    ON CONFLICT (due_template_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_dues_template_created
    AFTER INSERT ON public.dues_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_dues_for_active_members();


-- ----------------------------------------------------------------------------
-- A4: Trigger otomatis catat jurnal INCOME saat iuran berhasil diverifikasi
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE TRIGGER on_dues_payment_verified
    AFTER UPDATE ON public.dues_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.log_paid_dues_to_finances();


-- ----------------------------------------------------------------------------
-- A4: Trigger proteksi jurnal keuangan
--     UPDATE diizinkan untuk transaksi manual ('+ Catat Transaksi').
--     DELETE diizinkan HANYA untuk transaksi manual (source = 'keuangan');
--     transaksi yang berasal dari modul lain (inventory, dues) diblokir
--     karena hanya dapat dihapus di modul asalnya.
-- ----------------------------------------------------------------------------
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

CREATE TRIGGER trg_finances_no_delete
    BEFORE DELETE ON public.finances
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_finances_immutable();


-- ----------------------------------------------------------------------------
-- A11: Trigger proteksi data sertijab yang sudah COMPLETED
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_completed_handover()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Arsip Serah Terima Jabatan yang telah disahkan tidak dapat diubah kembali.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_handover
    BEFORE UPDATE ON public.handovers
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_completed_handover();


-- ----------------------------------------------------------------------------
-- A6: Trigger auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_programs
    BEFORE UPDATE ON public.programs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_handovers
    BEFORE UPDATE ON public.handovers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_divisions
    BEFORE UPDATE ON public.divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_incidental_projects
    BEFORE UPDATE ON public.incidental_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory_items
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory_loans
    BEFORE UPDATE ON public.inventory_loans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- BAGIAN 14: HELPER FUNCTIONS (Utility untuk aplikasi)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A4: Fungsi hitung saldo kas organisasi
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cash_balance()
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_income  NUMERIC(12,2);
    v_expense NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_income
    FROM public.finances WHERE type = 'INCOME';

    SELECT COALESCE(SUM(amount), 0) INTO v_expense
    FROM public.finances WHERE type = 'EXPENSE';

    RETURN v_income - v_expense;
END;
$$;

-- ----------------------------------------------------------------------------
-- A9: Fungsi hitung progres program kerja (% tugas DONE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_program_progress(p_program_id UUID)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total INTEGER;
    v_done  INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.tasks WHERE program_id = p_program_id;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_done
    FROM public.tasks
    WHERE program_id = p_program_id AND status = 'DONE';

    RETURN ROUND((v_done::NUMERIC / v_total::NUMERIC) * 100, 2);
END;
$$;

-- ----------------------------------------------------------------------------
-- A10: Fungsi hitung saldo kas proyek insidental
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_project_cash_balance(p_project_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_income  NUMERIC(12,2);
    v_expense NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_income
    FROM public.project_funds
    WHERE project_id = p_project_id AND type = 'INCOME';

    SELECT COALESCE(SUM(amount), 0) INTO v_expense
    FROM public.project_funds
    WHERE project_id = p_project_id AND type = 'EXPENSE';

    RETURN v_income - v_expense;
END;
$$;

-- ----------------------------------------------------------------------------
-- A7: Fungsi penomoran surat otomatis
--     Format: 001/SU/SIORG/VII/2026
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_letter_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq       INTEGER;
    v_month_num INTEGER;
    v_month     VARCHAR(5);
    v_year      VARCHAR(4);
    v_ref       VARCHAR(100);
    v_class     VARCHAR(2);
BEGIN
    -- Hitung nomor urut surat untuk bulan & tahun ini
    SELECT COUNT(*) + 1 INTO v_seq
    FROM public.letters
    WHERE EXTRACT(MONTH FROM date_received_sent) = EXTRACT(MONTH FROM NEW.date_received_sent)
      AND EXTRACT(YEAR FROM date_received_sent) = EXTRACT(YEAR FROM NEW.date_received_sent);

    -- Konversi bulan ke angka Romawi
    v_month_num := EXTRACT(MONTH FROM NEW.date_received_sent);
    v_month := CASE v_month_num
        WHEN 1  THEN 'I'    WHEN 2  THEN 'II'   WHEN 3  THEN 'III'
        WHEN 4  THEN 'IV'   WHEN 5  THEN 'V'    WHEN 6  THEN 'VI'
        WHEN 7  THEN 'VII'  WHEN 8  THEN 'VIII' WHEN 9  THEN 'IX'
        WHEN 10 THEN 'X'    WHEN 11 THEN 'XI'   WHEN 12 THEN 'XII'
    END;

    v_year := TO_CHAR(NEW.date_received_sent, 'YYYY');

    -- Klasifikasi surat (2 huruf pertama dari judul)
    v_class := UPPER(SUBSTRING(REPLACE(NEW.title, ' ', '') FROM 1 FOR 2));

    v_ref := LPAD(v_seq::TEXT, 3, '0')
          || '/' || v_class
          || '/SIORG/'
          || v_month || '/'
          || v_year;

    NEW.reference_number := v_ref;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_letter_reference
    BEFORE INSERT ON public.letters
    FOR EACH ROW
    WHEN (NEW.reference_number IS NULL OR NEW.reference_number = '')
    EXECUTE FUNCTION public.generate_letter_reference();


-- ============================================================================
-- BAGIAN 15: SEED DATA (Data awal untuk development)
-- ============================================================================

-- Divisi default
INSERT INTO public.divisions (name, description) VALUES
    ('Kestari',            'Kesekretariatan dan Administrasi'),
    ('Kewirausahaan',      'Pengembangan Jiwa Wirausaha'),
    ('Keagamaan',          'Pembinaan Kerohanian'),
    ('Sosial Masyarakat',  'Pengabdian kepada Masyarakat'),
    ('Hubungan Masyarakat','Humas & Jaringan Eksternal'),
    ('Olahraga',           'Pembinaan Prestasi Olahraga & Keatletan'),
    ('Seni dan Budaya',    'Pengembangan Seni dan Budaya')
ON CONFLICT (name) DO NOTHING;

-- Pengaturan organisasi default
INSERT INTO public.organization_settings (org_name, org_description, org_email, period_year)
VALUES (
    'SIORG',
    'Sistem Informasi Organisasi Kemahasiswaan',
    'admin@siorg.ac.id',
    '2025/2026'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- BAGIAN 16: SUPABASE STORAGE BUCKETS & POLICIES
--
-- Jalankan perintah ini di Supabase Dashboard > Storage > New Bucket
-- atau via SQL Editor dengan service_role key
-- ============================================================================

-- --- Buat Storage Buckets ---
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars',    'avatars',    true,  2097152,  ARRAY['image/png', 'image/jpeg', 'image/webp']),
    ('receipts',   'receipts',   true,  5242880,  ARRAY['image/png', 'image/jpeg', 'image/pdf']),
    ('proofs',     'proofs',     true,  5242880,  ARRAY['image/png', 'image/jpeg', 'image/pdf']),
    ('proposals',  'proposals',  false, 10485760, ARRAY['application/pdf']),
    ('lpj',        'lpj',        false, 10485760, ARRAY['application/pdf']),
    ('letters',    'letters',    false, 5242880,  ARRAY['image/png', 'image/jpeg', 'application/pdf']),
    ('sertijab',   'sertijab',   false, 5242880,  ARRAY['application/pdf']),
    ('achievements','achievements',true,5242880,  ARRAY['image/png', 'image/jpeg', 'application/pdf']),
    ('templates',  'templates',  false, 5242880,  ARRAY['*/*'])
ON CONFLICT (id) DO NOTHING;

-- --- Storage RLS Policies ---
-- Avatars: semua user terautentikasi bisa upload ke folder own
CREATE POLICY "avatars_upload_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "avatars_read_public"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');

-- Receipts, Proofs, Proposals, Letters, Sertijab: authenticated upload
CREATE POLICY "receipts_upload_auth"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'receipts');

CREATE POLICY "proofs_upload_auth"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'proofs');

CREATE POLICY "proofs_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'proofs');

CREATE POLICY "proposals_upload_core"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'proposals'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "proposals_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'proposals');

CREATE POLICY "lpj_upload_core"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'lpj'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "lpj_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'lpj');

CREATE POLICY "letters_upload_core"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'letters'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI', 'KABID')
    );

CREATE POLICY "letters_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'letters');

CREATE POLICY "sertijab_upload_core"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'sertijab'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
    );

CREATE POLICY "sertijab_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'sertijab');

CREATE POLICY "achievements_upload_auth"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'achievements');

CREATE POLICY "achievements_read_auth"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'achievements');

-- Templates: hanya admin/core yang bisa upload/read
CREATE POLICY "templates_manage_core"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'templates'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
    );


-- ============================================================================
-- BAGIAN 17: SUPABASE REALTIME PUBLICATION
--
-- Mengaktifkan Realtime (WebSocket) untuk tabel tertentu agar client
-- bisa menerima update secara live tanpa polling.
-- Jalankan ini di Supabase SQL Editor (hanya bisa via service_role)
-- ============================================================================

-- Aktifkan Realtime untuk tabel yang butuh live update
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dues_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.programs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.handovers;


-- ============================================================================
-- BAGIAN 18: SIMULASI CRUD (Contoh query untuk setiap modul)
-- Berikut adalah contoh query yang bisa dijalankan di SQL Editor Supabase
-- untuk menguji seluruh fitur CRUD setiap modul.
-- ============================================================================

-- ============================================================================
-- MODUL A5: MANAJEMEN ANGOTA
-- ============================================================================

-- [CREATE] Tambah anggota baru via Supabase Auth signup
-- (Di Supabase, ini dilakukan via supabase.auth.signUp() di client-side
--  yang akan memicu trigger on_auth_user_created -> otomatis buat profile)
-- Contoh data yang dikirim via raw_user_meta_data:
-- {
--   "full_name": "Andi Pratama",
--   "nim": "2406010001",
--   "phone_number": "08123456789",
--   "role": "ANGGOTA",
--   "division_id": "<UUID-divisi-kewirausahaan>"
-- }

-- [READ] Lihat daftar anggota dengan join divisi
SELECT
    p.id,
    p.full_name,
    p.nim,
    p.email,
    p.role,
    p.status,
    d.name AS division_name,
    p.joined_at
FROM public.profiles p
LEFT JOIN public.divisions d ON d.id = p.division_id
WHERE p.status = 'AKTIF'
ORDER BY p.full_name ASC
LIMIT 25;

-- [READ] Pencarian anggota (debounced search pattern)
SELECT * FROM public.profiles
WHERE full_name ILIKE '%andi%'
   OR nim ILIKE '%240601%'
ORDER BY full_name;

-- [UPDATE] Profil mandiri (hanya phone_number & avatar_url via RLS)
UPDATE public.profiles
SET phone_number = '085712345678',
    avatar_url = 'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/avatars/andi-new.jpg'
WHERE id = auth.uid();

-- [UPDATE] Admin ubah role anggota
UPDATE public.profiles
SET role = 'KABID'
WHERE id = '<69750a39-a545-4906-b206-3c30905ae33c>';

-- [UPDATE] Ubah status keaktifan (Soft-Delete)
UPDATE public.profiles
SET status = 'NONAKTIF'
WHERE id = '69750a39-a545-4906-b206-3c30905ae33c';


-- ============================================================================
-- MODUL A4: KEUANGAN
-- ============================================================================

-- [CREATE] Catat transaksi pemasukan (dengan receipt upload)
INSERT INTO public.finances (type, amount, description, date, receipt_url, created_by)
VALUES (
    'INCOME',
    500000,
    'Sponsor dari PT Maju Jaya untuk Seminar Kewirausahaan',
    '2026-07-10',
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/receipts/sponsor1.jpg',
    auth.uid()
);

-- [CREATE] Catat transaksi pengeluaran
INSERT INTO public.finances (type, amount, description, date, program_id, receipt_url, created_by)
VALUES (
    'EXPENSE',
    150000,
    'Pembelian spanduk acara Seminar Kewirausahaan',
    '2026-07-11',
    (SELECT id FROM public.programs WHERE name = 'Seminar Kewirausahaan' LIMIT 1),
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/receipts/spanduk.jpg',
    auth.uid()
);

-- [READ] Lihat buku besar kas dengan nama pencatat
SELECT
    f.date,
    f.type,
    f.amount,
    f.description,
    p.full_name AS recorded_by,
    pr.name AS related_program
FROM public.finances f
LEFT JOIN public.profiles p ON p.id = f.created_by
LEFT JOIN public.programs pr ON pr.id = f.program_id
ORDER BY f.date DESC;

-- [READ] Hitung saldo kas (via helper function)
SELECT public.get_cash_balance() AS saldo_kas_riil;

-- [UPDATE & DELETE] DI_tolak oleh trigger immutable
-- UPDATE public.finances SET amount = 999 WHERE id = '...';   -- ERROR!
-- DELETE FROM public.finances WHERE id = '...';               -- ERROR!

-- [CREATE] Buat template tagihan iuran bulanan
-- (Trigger on_dues_template_created akan otomatis buat UNPAID payments)
INSERT INTO public.dues_templates (title, amount, due_date, created_by)
VALUES (
    'Uang Kas Bulan Juli 2026',
    20000,
    '2026-07-31',
    auth.uid()
);

-- [READ] Lihat tagihan iuran yang belum dibayar
SELECT
    dp.id,
    p.full_name,
    p.nim,
    dt.title,
    dt.amount,
    dp.status,
    dp.payment_date
FROM public.dues_payments dp
JOIN public.profiles p ON p.id = dp.user_id
JOIN public.dues_templates dt ON dt.id = dp.due_template_id
WHERE dp.status = 'UNPAID'
ORDER BY dt.due_date;

-- [UPDATE] Anggota upload bukti bayar (via Supabase Storage -> proofs bucket)
UPDATE public.dues_payments
SET status = 'PENDING_VERIFICATION',
    payment_date = '2026-07-20',
    proof_url = 'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/proofs/bukti-andi.jpg'
WHERE user_id = auth.uid()
  AND due_template_id = '<template-uuid>';

-- [UPDATE] Bendahara approve pembayaran
-- (Trigger on_dues_payment_verified akan otomatis catat INCOME di finances)
UPDATE public.dues_payments
SET status = 'PAID',
    verified_by = auth.uid(),
    verified_at = now()
WHERE id = '<payment-uuid>';

-- [UPDATE] Bendahara tolak pembayaran
UPDATE public.dues_payments
SET status = 'UNPAID',
    feedback = 'Nominal transfer tidak sesuai, harap unggah ulang bukti yang benar.',
    verified_by = auth.uid(),
    verified_at = now()
WHERE id = '<payment-uuid>';


-- ============================================================================
-- MODUL A9: PROGRAM KERJA
-- ============================================================================

-- [CREATE] Buat program kerja baru
INSERT INTO public.programs (name, description, start_date, end_date, budget_estimate, division_id, created_by)
VALUES (
    'Seminar Kewirausahaan',
    'Seminar nasional tentang tips memulai bisnis bagi mahasiswa pemula',
    '2026-08-01',
    '2026-08-15',
    5000000,
    (SELECT id FROM public.divisions WHERE name = 'Kewirausahaan'),
    auth.uid()
);

-- [CREATE] Tambah panitia ke program kerja
INSERT INTO public.program_members (program_id, user_id, role_in_program)
VALUES (
    (SELECT id FROM public.programs WHERE name = 'Seminar Kewirausahaan' LIMIT 1),
    '<user-uuid>',
    'Ketua Pelaksana'
);

-- [CREATE] Tambah tugas ke Kanban Board
INSERT INTO public.tasks (program_id, title, status, priority, due_date, assigned_to)
VALUES (
    (SELECT id FROM public.programs WHERE name = 'Seminar Kewirausahaan' LIMIT 1),
    'Siapkan proposal sponsor',
    'TO_DO',
    'HIGH',
    '2026-07-20',
    '<user-uuid>'
);

-- [UPDATE] Ubah status tugas (Drag & Drop Kanban)
UPDATE public.tasks
SET status = 'IN_PROGRESS'
WHERE title = 'Siapkan proposal sponsor';

UPDATE public.tasks
SET status = 'DONE'
WHERE title = 'Siapkan proposal sponsor';

-- [READ] Lihat progres program kerja (via helper function)
SELECT
    p.name,
    p.status,
    public.get_program_progress(p.id) AS progress_percent
FROM public.programs p;

-- [UPDATE] Tutup program kerja dengan LPJ (hanya jika semua tugas DONE)
UPDATE public.programs
SET status = 'COMPLETED',
    lpj_url = 'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/lpj/seminar-kewirausahaan.pdf'
WHERE name = 'Seminar Kewirausahaan'
  AND public.get_program_progress(id) = 100;


-- ============================================================================
-- MODUL A3: KEATLETAN
-- ============================================================================

-- [CREATE] Definisikan metrik keatletan
INSERT INTO public.athletic_metrics (name, type, unit) VALUES
    ('Kecepatan 100m',   'QUANTITATIVE', 's'),
    ('Kekuatan (Bench Press)', 'QUANTITATIVE', 'kg'),
    ('Teknik Dasar',     'QUALITATIVE',  'skala 1-5'),
    ('Endurance (Lari 5km)', 'QUANTITATIVE', 'menit');

-- [CREATE] Mapping pelatih-atlet
INSERT INTO public.athlete_coach_mapping (coach_id, athlete_id)
VALUES ('<coach-uuid>', '<athlete-uuid>');

-- [CREATE] Buat sesi latihan
INSERT INTO public.training_sessions (coach_id, date, session_type, duration_minutes, intensity)
VALUES (auth.uid(), '2026-07-15', 'Kardio & Teknik', 90, 'HIGH');

-- [CREATE] Input penilaian hybrid atlet
INSERT INTO public.assessments (session_id, athlete_id, metric_id, value, notes)
VALUES (
    (SELECT id FROM public.training_sessions ORDER BY created_at DESC LIMIT 1),
    '<athlete-uuid>',
    (SELECT id FROM public.athletic_metrics WHERE name = 'Kecepatan 100m'),
    12.5,
    'Waktu menurun dari 13.0 detik - peningkatan bagus!'
);

-- [CREATE] Set target performa atlet
INSERT INTO public.athlete_targets (athlete_id, metric_id, target_value, is_active)
VALUES (
    '<athlete-uuid>',
    (SELECT id FROM public.athletic_metrics WHERE name = 'Kecepatan 100m'),
    12.0,
    true
);

-- [READ] Lihat progres atlet vs target
SELECT
    am.name AS metric_name,
    am.unit,
    at.target_value,
    (SELECT a.value FROM public.assessments a
     WHERE a.athlete_id = '<athlete-uuid>'
       AND a.metric_id = am.id
     ORDER BY a.created_at DESC LIMIT 1) AS latest_actual,
    CASE
        WHEN (SELECT a.value FROM public.assessments a
              WHERE a.athlete_id = '<athlete-uuid>'
                AND a.metric_id = am.id
              ORDER BY a.created_at DESC LIMIT 1) <= at.target_value
        THEN 'TARGET TERCAPAI'
        ELSE 'BELUM TERCAPAI'
    END AS status
FROM public.athlete_targets at
JOIN public.athletic_metrics am ON am.id = at.metric_id
WHERE at.athlete_id = '<athlete-uuid>'
  AND at.is_active = true;


-- ============================================================================
-- MODUL A7: PERSURATAN
-- ============================================================================

-- [CREATE] Arsipkan surat masuk (reference_number auto-generated via trigger)
INSERT INTO public.letters (type, title, sender, date_received_sent, classification, document_url, created_by)
VALUES (
    'INCOMING',
    'Undangan Rapat Kerja',
    'Dekanat Fakultas Teknik',
    '2026-07-05',
    'PUBLIC',
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/letters/undangan-raker.pdf',
    auth.uid()
);

-- [READ] Lihat katalog surat berdasarkan level kerahasiaan
SELECT
    reference_number,
    type,
    title,
    sender,
    date_received_sent,
    classification,
    created_at
FROM public.letters
ORDER BY date_received_sent DESC;


-- ============================================================================
-- MODUL A11: SERAH TERIMA JABATAN (SERTIJAB)
-- ============================================================================

-- [CREATE] Daftarkan event sertijab
INSERT INTO public.handovers (period_from, period_to, handover_date, witnesses, status, created_by)
VALUES (
    '2024/2025',
    '2025/2026',
    '2025-09-01',
    '[
        {"name": "Dr. Budi Santoso, M.T.", "nim": "NIP001", "role": "Pembina Organisasi"},
        {"name": "Rina Wulandari", "nim": "2206010045", "role": "Ketua Senat Mahasiswa"}
    ]'::jsonb,
    'NOT_STARTED',
    auth.uid()
);

-- [UPDATE] Unggah dokumen Berita Acara (NOT_STARTED -> ONGOING)
UPDATE public.handovers
SET document_url = 'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/sertijab/ba-2025-2026.pdf',
    status = 'ONGOING'
WHERE period_from = '2024/2025' AND period_to = '2025/2026';

-- [UPDATE] Pengesahan final oleh Admin (ONGOING -> COMPLETED)
UPDATE public.handovers
SET status = 'COMPLETED'
WHERE period_from = '2024/2025' AND period_to = '2025/2026'
  AND status = 'ONGOING';

-- [UPDATE] Coba edit data COMPLETED -> AKAN ERROR!
-- UPDATE public.handovers
-- SET witnesses = '[]'::jsonb
-- WHERE period_from = '2024/2025' AND status = 'COMPLETED';
-- ERROR: Arsip Serah Terima Jabatan yang telah disahkan tidak dapat diubah kembali.

-- [READ] Lihat arsip sertijab (publik untuk status COMPLETED)
SELECT
    period_from,
    period_to,
    handover_date,
    status,
    witnesses,
    document_url
FROM public.handovers
WHERE status = 'COMPLETED'
ORDER BY handover_date DESC;


-- ============================================================================
-- MODUL A8: PRESTASI ORGANISASI
-- ============================================================================

-- [CREATE] Ajukan prestasi baru (status = PENDING)
INSERT INTO public.achievements (title, description, type, category, level, organizer, achievement_date, proof_url, created_by)
VALUES (
    'Juara 1 Debat Nasional',
    'Tim debat SIORG berhasil meraih juara 1 dalam kompetisi debat nasional tingkat perguruan tinggi',
    'ORGANIZATION',
    'Akademik',
    'Nasional',
    'Kementerian Pendidikan',
    '2026-06-15',
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/achievements/sertifikat-debat.jpg',
    auth.uid()
);

-- [CREATE] Tambah peserta prestasi
INSERT INTO public.achievement_participants (achievement_id, user_id, role_in_achievement)
VALUES (
    (SELECT id FROM public.achievements WHERE title = 'Juara 1 Debat Nasional' LIMIT 1),
    '<user-uuid>',
    'Ketua Tim'
);

-- [UPDATE] Verifikasi & Publikasikan prestasi
UPDATE public.achievements
SET status = 'APPROVED'
WHERE title = 'Juara 1 Debat Nasional' AND status = 'PENDING';

-- [UPDATE] Tolak pengajuan prestasi
UPDATE public.achievements
SET status = 'REJECTED',
    rejection_reason = 'Foto sertifikat terlalu blur, mohon unggah ulang dengan kualitas lebih baik'
WHERE status = 'PENDING' AND title = 'Prestasi Lain';

-- [READ] Lihat galeri prestasi (hanya yang APPROVED)
SELECT
    a.title,
    a.type,
    a.category,
    a.level,
    a.organizer,
    a.achievement_date,
    STRING_AGG(ap.role_in_achievement || ': ' || p.full_name, ', ') AS participants
FROM public.achievements a
LEFT JOIN public.achievement_participants ap ON ap.achievement_id = a.id
LEFT JOIN public.profiles p ON p.id = ap.user_id
WHERE a.status = 'APPROVED'
GROUP BY a.id
ORDER BY a.achievement_date DESC;


-- ============================================================================
-- MODUL A10: PROYEK INSIDENTAL
-- ============================================================================

-- [CREATE] Ajukan proyek insidental
INSERT INTO public.incidental_projects (name, description, urgency_level, start_date, end_date, budget_source, status, created_by)
VALUES (
    'Panitia Wisuda Darurat',
    'Tim task force untuk membantu panitia wisuda karena adanya kekosongan panitia',
    'HIGH',
    '2026-07-20',
    '2026-08-10',
    'Sponsor Eksternal + Kas Organisasi',
    'PROPOSED',
    auth.uid()
);

-- [UPDATE] Setujui proyek (PROPOSED -> APPROVED)
UPDATE public.incidental_projects
SET status = 'APPROVED'
WHERE name = 'Panitia Wisuda Darurat' AND status = 'PROPOSED';

-- [CREATE] Bentuk tim lintas divisi
INSERT INTO public.project_team (project_id, user_id, project_role)
VALUES (
    (SELECT id FROM public.incidental_projects WHERE name = 'Panitia Wisuda Darurat' LIMIT 1),
    '<user-uuid>',
    'Project Lead'
);

-- [CREATE] Pencatatan dana masuk sponsor
INSERT INTO public.project_funds (project_id, type, amount, source, description, date, receipt_url, created_by)
VALUES (
    (SELECT id FROM public.incidental_projects WHERE name = 'Panitia Wisuda Darurat' LIMIT 1),
    'INCOME',
    2000000,
    'PT Maju Jaya',
    'Sponsor kegiatan wisuda',
    '2026-07-22',
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/receipts/sponsor-wisuda.jpg',
    auth.uid()
);

-- [CREATE] Pencatatan pengeluaran proyek
INSERT INTO public.project_funds (project_id, type, amount, source, description, date, receipt_url, created_by)
VALUES (
    (SELECT id FROM public.incidental_projects WHERE name = 'Panitia Wisuda Darurat' LIMIT 1),
    'EXPENSE',
    800000,
    NULL,
    'Pembelian dekorasi panggung wisuda',
    '2026-07-25',
    'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/receipts/dekorasi.jpg',
    auth.uid()
);

-- [CREATE] Tambah milestone
INSERT INTO public.project_milestones (project_id, title, due_date)
VALUES (
    (SELECT id FROM public.incidental_projects WHERE name = 'Panitia Wisuda Darurat' LIMIT 1),
    'Vendor Deal',
    '2026-07-28'
);

-- [READ] Lihat saldo kas & progres proyek
SELECT
    ip.name AS project_name,
    ip.status,
    public.get_project_cash_balance(ip.id) AS sisa_dana,
    (SELECT COUNT(*) FROM public.project_milestones pm
     WHERE pm.project_id = ip.id AND pm.is_completed) AS milestones_selesai,
    (SELECT COUNT(*) FROM public.project_milestones pm
     WHERE pm.project_id = ip.id) AS total_milestones
FROM public.incidental_projects ip;

-- [UPDATE] Tandai milestone selesai
UPDATE public.project_milestones
SET is_completed = true,
    completed_at = now()
WHERE title = 'Vendor Deal'
  AND project_id = (SELECT id FROM public.incidental_projects WHERE name = 'Panitia Wisuda Darurat' LIMIT 1);

-- [UPDATE] Tutup proyek
UPDATE public.incidental_projects
SET status = 'CLOSED'
WHERE name = 'Panitia Wisuda Darurat' AND status = 'ONGOING';


-- ============================================================================
-- MODUL A6: PENGATURAN & AUDIT
-- ============================================================================

-- [UPDATE] Ubah nama & logo organisasi
UPDATE public.organization_settings
SET org_name = 'SIORG v2',
    org_logo_url = 'https://apnlpdtgurvbdfkyzoxg.supabase.co/storage/v1/object/public/avatars/siorg-logo.png'
WHERE id = (SELECT id FROM public.organization_settings LIMIT 1);

-- [UPDATE] Aktifkan mode pemeliharaan
UPDATE public.organization_settings
SET is_maintenance = true;

-- [CREATE] Catat audit log untuk perubahan sensitif
INSERT INTO public.audit_logs (user_id, action, target_table, target_id, old_value, new_value)
VALUES (
    auth.uid(),
    'UPDATE_STATUS',
    'profiles',
    '<target-user-uuid>',
    '{"status": "AKTIF"}'::jsonb,
    '{"status": "NONAKTIF"}'::jsonb
);

-- [READ] Lihat audit log (hanya admin)
SELECT
    al.created_at,
    al.action,
    al.target_table,
    p.full_name AS actor,
    al.old_value,
    al.new_value
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 20;


-- ============================================================================
-- RINGKASAN STRUKTUR DATABASE SIORG (26 Tabel)
-- ============================================================================
-- NO  | TABEL                      | PRD   | KETERANGAN
-- ----|----------------------------|-------|---------------------------------------------
--  1  | profiles                   | A2,A5 | Profil pengguna (terintegrasi auth.users)
--  2  | divisions                  | A5,A6 | Daftar divisi/bidang organisasi
--  3  | organization_settings      | A6    | Pengaturan global organisasi
--  4  | audit_logs                 | A6    | Jejak audit perubahan sensitif
--  5  | programs                   | A9    | Program kerja / proker
--  6  | program_members            | A9    | Kepanitiaan program kerja
--  7  | tasks                      | A9    | Tugas Kanban board
--  8  | finances                   | A4    | Jurnal kas (IMMUTABLE)
--  9  | dues_templates             | A4    | Template tagihan iuran
-- 10  | dues_payments              | A4    | Status pembayaran iuran anggota
-- 11  | attendances                | A5    | Presensi kehadiran anggota
-- 12  | letters                    | A7    | Katalog surat masuk/keluar
-- 13  | handovers                  | A7,A11| Serah terima jabatan
-- 14  | athletic_metrics           | A3    | Metrik kemampuan atlet
-- 15  | athlete_coach_mapping      | A3    | Mapping pelatih-atlet
-- 16  | training_sessions          | A3    | Log sesi latihan harian
-- 17  | training_session_attendants| A3    | Kehadiran atlet dalam sesi latihan
-- 18  | assessments                | A3    | Hasil penilaian hybrid atlet
-- 19  | athlete_targets            | A3    | Target performa atlet
-- 20  | achievements               | A8    | Data prestasi organisasi/individu
-- 21  | achievement_participants   | A8    | Peserta/anggota dalam prestasi
-- 22  | incidental_projects        | A10   | Proyek ad-hoc/insidental
-- 23  | project_funds              | A10   | Dana masuk/keluar proyek insidental
-- 24  | project_team               | A10   | Tim task force lintas divisi
-- 25  | project_milestones         | A10   | Milestone pelacakan proyek
-- 26  | attendances                | A5    | Presensi kehadiran di program kerja
--
-- STORAGE BUCKETS: avatars, receipts, proofs, proposals, lpj, letters,
--                  sertijab, achievements, templates
-- REALTIME TABLES: tasks, finances, dues_payments, programs, profiles, handovers
-- ============================================================================
