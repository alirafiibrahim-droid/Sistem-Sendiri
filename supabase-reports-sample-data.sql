-- ============================================================================
-- SAMPLE DATA: Modul Pelaporan (A13) — data contoh untuk uji coba laporan
-- Jalankan SETELAH: supabase-reports-migration.sql (KOP fields + report_files)
-- Jalankan di Supabase Dashboard SQL Editor
--
-- Catatan: Skrip ini idempotent (aman dijalankan ulang).
-- Data contoh mencakup seluruh jenis laporan pada katalog RPT-*.
-- ============================================================================

-- ============================================================================
-- 1. KOP SURAT — lengkapi data organisasi (field dari migration)
-- ============================================================================
UPDATE public.organization_settings
SET org_description = COALESCE(NULLIF(org_description, ''), 'Sekretariat UKM Atletik Universitas Nusantara, Jl. Merdeka No. 10, Bandung'),
    org_email = COALESCE(org_email, 'ukm.atletik@uninus.ac.id'),
    org_address = 'Jl. Merdeka No. 10, Kota Bandung, Jawa Barat',
    org_phone_number = '081234567890',
    period_year = COALESCE(period_year, '2025/2026');

-- ============================================================================
-- 2. FAKULTAS & JURUSAN (pastikan tersedia untuk filter laporan anggota)
-- ============================================================================
INSERT INTO public.fakultas (name, description)
VALUES
  ('Fakultas Ilmu Komputer', 'Fakultas Ilmu Komputer'),
  ('Fakultas Hukum', 'Fakultas Hukum'),
  ('Fakultas Ekonomi dan Bisnis', 'Fakultas Ekonomi dan Bisnis'),
  ('Fakultas Ilmu Sosial dan Ilmu Politik', 'Fakultas Ilmu Sosial dan Ilmu Politik')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.jurusan (name, description, fakultas_id)
SELECT v.name, v.name, f.id
FROM (VALUES
  ('Sistem Informasi', 'Fakultas Ilmu Komputer'),
  ('Teknik Informatika', 'Fakultas Ilmu Komputer'),
  ('Ilmu Hukum', 'Fakultas Hukum'),
  ('Manajemen', 'Fakultas Ekonomi dan Bisnis'),
  ('Akuntansi', 'Fakultas Ekonomi dan Bisnis'),
  ('Ilmu Komunikasi', 'Fakultas Ilmu Sosial dan Ilmu Politik')
) AS v(name, fakultas_name)
JOIN public.fakultas f ON f.name = v.fakultas_name
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. DIVISI
-- ============================================================================
INSERT INTO public.divisions (name, description) VALUES
  ('Bidang Kominfo', 'Bidang Komunikasi dan Informasi'),
  ('Bidang Sosmas', 'Bidang Sosial Masyarakat'),
  ('Bidang PSDM', 'Bidang Pengembangan Sumber Daya Manusia'),
  ('Bidang Danus', 'Bidang Dana dan Usaha'),
  ('Bidang Kesekretariatan', 'Bidang Kesekretariatan')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 4. BANK, KAS, DOMPET
-- ============================================================================
INSERT INTO public.banks (name, account_number, account_holder, description) VALUES
  ('Bank BNI', '0012345678', 'UKM Atletik Universitas Nusantara', 'Rekening kas utama'),
  ('Bank BRI', '0098765432', 'UKM Atletik Universitas Nusantara', 'Rekening iuran')
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_accounts (name, description) VALUES
  ('Kas Sekretariat', 'Kas tunai harian sekretariat'),
  ('Kas Kegiatan', 'Kas tunai operasional kegiatan')
ON CONFLICT DO NOTHING;

INSERT INTO public.wallets (name, description, bank_id, cash_account_id) VALUES
  ('Dompet BNI', 'Dompet digital terkait Bank BNI', (SELECT id FROM public.banks WHERE name = 'Bank BNI'), NULL),
  ('Dompet BRI', 'Dompet digital terkait Bank BRI', (SELECT id FROM public.banks WHERE name = 'Bank BRI'), NULL),
  ('Dompet Kas Sekretariat', 'Dompet tunai sekretariat', NULL, (SELECT id FROM public.cash_accounts WHERE name = 'Kas Sekretariat'))
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. PROGRAM KERJA (RPT-FIN-01 & RPT-ATT-*)
-- ============================================================================
DO $$
DECLARE
  v_div_kominfo UUID;
  v_div_sosmas  UUID;
  v_creator     UUID;
  v_prog_1      UUID;
  v_prog_2      UUID;
  v_income      NUMERIC := 5000000;
  v_expense_1   NUMERIC := 3250000;
  v_expense_2   NUMERIC := 2400000;
BEGIN
  SELECT id INTO v_div_kominfo FROM public.divisions WHERE name = 'Bidang Kominfo';
  SELECT id INTO v_div_sosmas  FROM public.divisions WHERE name = 'Bidang Sosmas';
  SELECT id INTO v_creator FROM public.profiles WHERE role IN ('ADMIN','KETUA_UMUM','PENGURUS_INTI') LIMIT 1;

  -- Proker 1: Seminar Kewirausahaan (ONGOING)
  SELECT id INTO v_prog_1 FROM public.programs WHERE name = 'Seminar Kewirausahaan' LIMIT 1;
  IF v_prog_1 IS NULL THEN
    INSERT INTO public.programs (name, description, start_date, end_date, budget_estimate, status, division_id, created_by)
    VALUES ('Seminar Kewirausahaan', 'Seminar nasional kewirausahaan mahasiswa', '2026-07-01', '2026-09-30', v_income, 'ONGOING', v_div_kominfo, v_creator)
    RETURNING id INTO v_prog_1;

    INSERT INTO public.budget_items (program_id, name, quantity, unit_price, subtotal, created_by)
    VALUES
      (v_prog_1, 'Sewa Gedung', 1, 2000000, 2000000, v_creator),
      (v_prog_1, 'Konsumsi Peserta', 100, 20000, 2000000, v_creator),
      (v_prog_1, 'Spanduk & Publikasi', 1, 1000000, 1000000, v_creator);
  END IF;

  -- Proker 2: Bakti Sosial (COMPLETED)
  SELECT id INTO v_prog_2 FROM public.programs WHERE name = 'Bakti Sosial' LIMIT 1;
  IF v_prog_2 IS NULL THEN
    INSERT INTO public.programs (name, description, start_date, end_date, budget_estimate, status, division_id, created_by)
    VALUES ('Bakti Sosial', 'Kegiatan bakti sosial panti asuhan', '2026-03-01', '2026-04-30', 2500000, 'COMPLETED', v_div_sosmas, v_creator)
    RETURNING id INTO v_prog_2;

    INSERT INTO public.budget_items (program_id, name, quantity, unit_price, subtotal, created_by)
    VALUES
      (v_prog_2, 'Sembako', 50, 40000, 2000000, v_creator),
      (v_prog_2, 'Transportasi', 1, 500000, 500000, v_creator);
  END IF;

  -- ============================================================================
  -- 6. TRANSAKSI KEUANGAN (RPT-FIN-01..03)
  -- ============================================================================
  INSERT INTO public.finances (type, amount, description, date, program_id, receipt_url, created_by, source,
                               wallet_id, bank_id, cash_account_id)
  VALUES
    ('INCOME', 3000000, 'Sponsor PT Maju Jaya untuk Seminar', '2026-07-05', v_prog_1, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet BNI'), NULL, NULL),
    ('INCOME', 2000000, 'Iuran anggota periode seminar', '2026-07-20', v_prog_1, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet BNI'), NULL, NULL),
    ('EXPENSE', 1500000, 'Pembayaran sewa gedung', '2026-07-10', v_prog_1, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet BNI'), NULL, NULL),
    ('EXPENSE', 1750000, 'Belanja konsumsi peserta', '2026-08-15', v_prog_1, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet Kas Sekretariat'), NULL, NULL),
    ('EXPENSE', 1500000, 'Pembelian sembako', '2026-03-15', v_prog_2, '', v_creator, 'keuangan',
     NULL, (SELECT id FROM public.banks WHERE name = 'Bank BRI'), NULL),
    ('EXPENSE', 900000, 'Transportasi panitia', '2026-04-02', v_prog_2, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet Kas Sekretariat'), NULL, NULL),
    ('INCOME', 500000, 'Kas masuk umum (donasi)', '2026-06-10', NULL, '', v_creator, 'keuangan',
     (SELECT id FROM public.wallets WHERE name = 'Dompet Kas Sekretariat'), NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 7. SESI PROGRAM & PRESENSI (RPT-ATT-01..02)
  -- ============================================================================
  INSERT INTO public.program_sessions (program_id, date, title, session_code)
  VALUES
    (v_prog_1, '2026-07-10', 'Rapat Persiapan Seminar', 'RAPATAN'),
    (v_prog_1, '2026-08-20', 'Pelaksanaan Seminar', 'SEMNARA')
  ON CONFLICT DO NOTHING;

  -- Presensi untuk seluruh anggota AKTIF pada sesi (hadir semua kecuali beberapa)
  FOR i IN 1..2 LOOP
    INSERT INTO public.program_session_attendants (session_id, user_id, method, scanned_at, score)
    SELECT s.id, p.id, 'MANUAL',
           (s.date + INTERVAL '9 hours')::timestamptz,
           8 + (i % 2)
    FROM public.program_sessions s
    CROSS JOIN public.profiles p
    WHERE s.title IN ('Rapat Persiapan Seminar', 'Pelaksanaan Seminar')
      AND p.status = 'AKTIF'
      AND p.role NOT IN ('PELATIH', 'PEMBINA')
      AND abs(hashtext(p.id::text || s.id::text)) % 7 != 0  -- sebagian tidak hadir
    ON CONFLICT (session_id, user_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- 8. LATIHAN KEATLETAN (RPT-ATH-01..03)
  -- ============================================================================
  DECLARE
    v_coach   UUID;
    v_train1  UUID;
    v_train2  UUID;
    v_sess1   UUID;
    v_sess2   UUID;
    v_metric  UUID;
  BEGIN
    SELECT id INTO v_coach FROM public.profiles WHERE role = 'PELATIH' LIMIT 1;
    IF v_coach IS NULL THEN
      SELECT id INTO v_coach FROM public.profiles WHERE role IN ('ADMIN','PENGURUS_INTI') LIMIT 1;
    END IF;

    SELECT id INTO v_train1 FROM public.trainings WHERE name = 'Sprint 100m' LIMIT 1;
    SELECT id INTO v_train2 FROM public.trainings WHERE name = 'Bench Press' LIMIT 1;

    IF v_train1 IS NOT NULL THEN
      INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity, session_code)
      VALUES (v_coach, v_train1, '2026-07-06', 'Sprint 100m', 60, 'HIGH', 'LATSPRX')
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_sess1 FROM public.training_sessions WHERE date = '2026-07-06' LIMIT 1;

      INSERT INTO public.training_session_attendants (session_id, athlete_id, method, scanned_at)
      SELECT v_sess1, p.id, 'MANUAL', ('2026-07-06 16:00:00')::timestamptz
      FROM public.profiles p
      WHERE p.role NOT IN ('PELATIH', 'PEMBINA') AND p.status = 'AKTIF'
      ON CONFLICT (session_id, athlete_id) DO NOTHING;
    END IF;

    IF v_train2 IS NOT NULL THEN
      INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity, session_code)
      VALUES (v_coach, v_train2, '2026-07-13', 'Bench Press', 45, 'MEDIUM', 'BENCHPR')
      ON CONFLICT DO NOTHING;
      SELECT id INTO v_sess2 FROM public.training_sessions WHERE date = '2026-07-13' LIMIT 1;

      INSERT INTO public.training_session_attendants (session_id, athlete_id, method, scanned_at)
      SELECT v_sess2, p.id, 'MANUAL', ('2026-07-13 16:00:00')::timestamptz
      FROM public.profiles p
      WHERE p.role NOT IN ('PELATIH', 'PEMBINA') AND p.status = 'AKTIF'
      ON CONFLICT (session_id, athlete_id) DO NOTHING;
    END IF;

    -- Penilaian atlet (RPT-ATH-02..03)
    FOR v_metric IN SELECT id FROM public.athletic_metrics
    LOOP
      INSERT INTO public.assessments (session_id, athlete_id, metric_id, value, notes)
      SELECT COALESCE(v_sess1, v_sess2), p.id, v_metric, (random() * 5 + 5)::NUMERIC(3,1), 'Penilaian sampel'
      FROM public.profiles p
      WHERE p.role NOT IN ('PELATIH', 'PEMBINA') AND p.status = 'AKTIF'
      ON CONFLICT DO NOTHING;
    END LOOP;
  END;

  -- ============================================================================
  -- 9. PRESTASI (RPT-ACH-01)
  -- ============================================================================
  INSERT INTO public.achievements (title, description, type, category, level, organizer, achievement_date, juara, status, created_by)
  SELECT 'Juara I Kejuaraan Atletik Mahasiswa Nasional', 'Lari 100m putra', 'INDIVIDUAL', 'ATLETIK', 'Nasional', 'Universitas Nusantara', '2026-05-05', 'JUARA_I', 'APPROVED', v_creator
  WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE title = 'Juara I Kejuaraan Atletik Mahasiswa Nasional');

  INSERT INTO public.achievements (title, description, type, category, level, organizer, achievement_date, juara, status, created_by)
  SELECT 'Juara II Lomba Pencak Silat', 'Kelas pemula', 'INDIVIDUAL', 'PENCAK_SILAT', 'Provinsi', 'KONI Jawa Barat', '2026-08-20', 'JUARA_II', 'APPROVED', v_creator
  WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE title = 'Juara II Lomba Pencak Silat');

  INSERT INTO public.achievements (title, description, type, category, level, organizer, achievement_date, juara, status, created_by)
  SELECT 'Kejuaraan Futsal Antar UKM', 'Babak penyisihan', 'ORGANIZATION', 'FUTSAL', 'Kota', 'Universitas Nusantara', '2026-09-01', NULL, 'PENDING', v_creator
  WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE title = 'Kejuaraan Futsal Antar UKM');

  -- Peserta prestasi (ambil anggota aktif pertama)
  INSERT INTO public.achievement_participants (achievement_id, user_id, juara, keterangan)
  SELECT a.id, p.id, 'JUARA_I', 'Peserta utama'
  FROM public.achievements a
  CROSS JOIN LATERAL (SELECT id FROM public.profiles WHERE role NOT IN ('PELATIH','PEMBINA') AND status = 'AKTIF' ORDER BY joined_at LIMIT 1) p
  WHERE a.title IN ('Juara I Kejuaraan Atletik Mahasiswa Nasional', 'Juara II Lomba Pencak Silat')
  ON CONFLICT (achievement_id, user_id) DO NOTHING;

  -- ============================================================================
  -- 10. INVENTARIS (RPT-INV-01..06)
  -- ============================================================================
  INSERT INTO public.inventory_items (code, name, category, stock, unit_price, condition, location, description, created_by)
  VALUES
    ('BRG-9001', 'Proyektor Epson', 'ELECTRONICS', 2, 4500000, 'GOOD', 'Ruang Sekretariat', 'Proyektor untuk kegiatan', v_creator),
    ('BRG-9002', 'Speaker JBL', 'ELECTRONICS', 1, 2000000, 'DAMAGED_LIGHT', 'Gudang Lantai 2', 'Speaker sound system', v_creator),
    ('BRG-9003', 'Meja Lipat', 'FURNITURE', 10, 350000, 'GOOD', 'Gudang Lantai 2', 'Meja untuk acara', v_creator),
    ('BRG-9004', 'Kertas A4', 'STATIONERY', 50, 50000, 'GOOD', 'Ruang Sekretariat', 'Perlengkapan ATK', v_creator),
    ('BRG-9005', 'Trophy Juara I', 'OTHER', 1, 500000, 'LOST', 'Ruang Piala', 'Piala kejuaraan', v_creator)
  ON CONFLICT (code) DO NOTHING;

  -- Pembelian inventaris (RPT-INV-03)
  INSERT INTO public.inventory_purchases (item_id, amount, date, wallet_id, description, created_by)
  SELECT i.id, 9000000, '2026-05-10',
         (SELECT id FROM public.wallets WHERE name = 'Dompet BNI'),
         'Pembelian 2 unit proyektor', v_creator
  FROM public.inventory_items i WHERE i.code = 'BRG-9001'
  ON CONFLICT DO NOTHING;

  -- Peminjaman inventaris (RPT-INV-04)
  INSERT INTO public.inventory_loans (item_id, borrower_id, quantity, borrow_date, return_date, actual_return, purpose, status)
  SELECT i.id, p.id, 1, '2026-08-01', '2026-08-03', '2026-08-03', 'Peminjaman untuk seminar', 'RETURNED'
  FROM public.inventory_items i
  CROSS JOIN LATERAL (SELECT id FROM public.profiles WHERE role NOT IN ('PELATIH','PEMBINA') AND status = 'AKTIF' ORDER BY joined_at LIMIT 1) p
  WHERE i.code = 'BRG-9001'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.inventory_loans (item_id, borrower_id, quantity, borrow_date, return_date, purpose, status)
  SELECT i.id, p.id, 2, '2026-08-15', '2026-08-20', 'Peminjaman untuk bakti sosial', 'APPROVED'
  FROM public.inventory_items i
  CROSS JOIN LATERAL (SELECT id FROM public.profiles WHERE role NOT IN ('PELATIH','PEMBINA') AND status = 'AKTIF' ORDER BY joined_at LIMIT 1) p
  WHERE i.code = 'BRG-9003'
  ON CONFLICT DO NOTHING;

  -- Penghapusan inventaris (RPT-INV-05)
  INSERT INTO public.inventory_disposals (item_id, quantity, reason, disposal_date, value_removed, created_by)
  SELECT i.id, 1, 'Penghapusan karena hilang', '2026-06-20', 500000, v_creator
  FROM public.inventory_items i WHERE i.code = 'BRG-9005'
  ON CONFLICT DO NOTHING;

  -- Log kerusakan (melengkapi data kondisi)
  INSERT INTO public.inventory_damage_logs (item_id, reported_by, incident_date, type, description, estimated_cost)
  SELECT i.id, v_creator, '2026-07-01', 'DAMAGE', 'Speaker rusak ringan saat kegiatan', 150000
  FROM public.inventory_items i WHERE i.code = 'BRG-9002'
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- 11. PERSURATAN (RPT-LTR-01..02)
  -- ============================================================================
  INSERT INTO public.letters (type, reference_number, title, sender, date_received_sent, classification, document_url, created_by)
  VALUES
    ('INCOMING', 'SKR/001/XII/2026', 'Undangan Rapat Ormawa', 'BEM Universitas Nusantara', '2026-12-02', 'PUBLIC', '', v_creator),
    ('INCOMING', 'SKR/002/XII/2026', 'Permohonan Data Prestasi', 'Biro Kemahasiswaan', '2026-12-15', 'CONFIDENTIAL', '', v_creator),
    ('OUTGOING', 'SKL/001/IX/2026', 'Permohonan Sponsor', 'PT Maju Jaya', '2026-09-05', 'PUBLIC', '', v_creator),
    ('OUTGOING', 'SKL/002/X/2026', 'Surat Tugas Kejuaraan', 'KONI Jawa Barat', '2026-10-10', 'PUBLIC', '', v_creator)
  ON CONFLICT (reference_number) DO NOTHING;

  -- ============================================================================
  -- 12. PROYEK INSIDENTAL (RPT-PRJ-01..02)
  -- ============================================================================
  DECLARE
    v_proj_1 UUID;
    v_proj_2 UUID;
  BEGIN
    SELECT id INTO v_proj_1 FROM public.incidental_projects WHERE name = 'Perbaikan Sound System' LIMIT 1;
    IF v_proj_1 IS NULL THEN
      INSERT INTO public.incidental_projects (name, description, urgency_level, start_date, end_date, budget_source, status, created_by)
      VALUES ('Perbaikan Sound System', 'Perbaikan speaker yang rusak', 'NORMAL', '2026-07-01', '2026-07-15', 'Kas Kegiatan', 'ONGOING', v_creator)
      RETURNING id INTO v_proj_1;

      INSERT INTO public.budget_items (project_id, name, quantity, unit_price, subtotal, created_by)
      VALUES (v_proj_1, 'Spare part speaker', 1, 1200000, 1200000, v_creator),
             (v_proj_1, 'Jasa servis', 1, 300000, 300000, v_creator);

      INSERT INTO public.project_funds (project_id, type, amount, source, description, date, created_by)
      VALUES (v_proj_1, 'INCOME', 2000000, 'Kas Kegiatan', 'Dana perbaikan', '2026-07-01', v_creator),
             (v_proj_1, 'EXPENSE', 900000, 'Kas Kegiatan', 'Down payment servis', '2026-07-05', v_creator);
    END IF;

    SELECT id INTO v_proj_2 FROM public.incidental_projects WHERE name = 'Rekrutmen Anggota Baru' LIMIT 1;
    IF v_proj_2 IS NULL THEN
      INSERT INTO public.incidental_projects (name, description, urgency_level, start_date, end_date, budget_source, status, created_by)
      VALUES ('Rekrutmen Anggota Baru', 'Open recruitment anggota', 'LOW', '2026-03-01', '2026-03-31', 'Danus', 'CLOSED', v_creator)
      RETURNING id INTO v_proj_2;

      INSERT INTO public.budget_items (project_id, name, quantity, unit_price, subtotal, created_by)
      VALUES (v_proj_2, 'Cetak pamflet', 200, 2500, 500000, v_creator);

      INSERT INTO public.project_funds (project_id, type, amount, source, description, date, created_by)
      VALUES (v_proj_2, 'INCOME', 500000, 'Danus', 'Anggaran rekrutmen', '2026-03-01', v_creator),
             (v_proj_2, 'EXPENSE', 480000, 'Danus', 'Cetak pamflet', '2026-03-10', v_creator);
    END IF;
  END;

  -- ============================================================================
  -- 13. PROGRAM KERJA per PERIODE (RPT-PRG-01..03)
  --     Catatan: kolom programs.handover_id berasal dari supabase-program-period.sql
  -- ============================================================================
  DECLARE
    v_handover UUID;
  BEGIN
    SELECT id INTO v_handover FROM public.handovers
    WHERE period_from = '2024/2025' AND period_to = '2025/2026' LIMIT 1;

    -- Jika periode sampel belum ada, buat periode Sertijab yang sudah selesai.
    IF v_handover IS NULL THEN
      INSERT INTO public.handovers (period_from, period_to, handover_date, witnesses, status, created_by)
      VALUES ('2024/2025', '2025/2026', '2025-09-01', '[]'::jsonb, 'COMPLETED', v_creator)
      RETURNING id INTO v_handover;
    END IF;

    -- Hubungkan proker sampel ke periode tersebut.
    UPDATE public.programs
    SET handover_id = v_handover
    WHERE id IN (v_prog_1, v_prog_2);

    -- Keanggotaan sampel (RPT-PRG-03 ringkas: total anggota per proker)
    INSERT INTO public.program_members (program_id, user_id, role_in_program)
    SELECT v_prog_1, p.id, 'Panitia'
    FROM public.profiles p
    WHERE p.status = 'AKTIF' AND p.role NOT IN ('PELATIH', 'PEMBINA')
      AND NOT EXISTS (SELECT 1 FROM public.program_members pm
                      WHERE pm.program_id = v_prog_1 AND pm.user_id = p.id)
    LIMIT 15;

    INSERT INTO public.program_members (program_id, user_id, role_in_program)
    SELECT v_prog_2, p.id, 'Panitia'
    FROM public.profiles p
    WHERE p.status = 'AKTIF' AND p.role NOT IN ('PELATIH', 'PEMBINA')
      AND NOT EXISTS (SELECT 1 FROM public.program_members pm
                      WHERE pm.program_id = v_prog_2 AND pm.user_id = p.id)
    LIMIT 12;
  END;

  RAISE NOTICE '=== Sampel data laporan selesai ===';
END $$;
