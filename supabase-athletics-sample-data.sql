-- ============================================================================
-- SAMPLE DATA: Athletics V2 — fully automated, no hardcoded UUIDs
-- Jalankan di Supabase Dashboard SQL Editor
-- ============================================================================

-- 1. Seed trainings (jika belum ada)
INSERT INTO public.trainings (name, category) VALUES
  ('Sprint 100m', 'SPEED'),
  ('Bench Press', 'STRENGTH'),
  ('Shuttle Run', 'AGILITY'),
  ('Long Distance 5K', 'ENDURANCE'),
  ('Hamstring Stretch', 'FLEXIBILITY'),
  ('Plyometric Jumps', 'POWER'),
  ('Dribbling Drill', 'TEKNIK'),
  ('Visualization Exercise', 'MENTAL'),
  ('Small-sided Game', 'GAME_INTELLIGENCE')
ON CONFLICT DO NOTHING;

-- 2. Seed athletic_metrics (jika belum ada)
INSERT INTO public.athletic_metrics (name, type, unit, category)
VALUES
  ('Penilaian Strength', 'QUANTITATIVE', 'skala 1-10', 'STRENGTH'),
  ('Penilaian Power', 'QUANTITATIVE', 'skala 1-10', 'POWER'),
  ('Penilaian Speed', 'QUANTITATIVE', 'skala 1-10', 'SPEED'),
  ('Penilaian Agility', 'QUANTITATIVE', 'skala 1-10', 'AGILITY'),
  ('Penilaian Endurance', 'QUANTITATIVE', 'skala 1-10', 'ENDURANCE'),
  ('Penilaian Flexibility', 'QUANTITATIVE', 'skala 1-10', 'FLEXIBILITY'),
  ('Penilaian Teknik', 'QUANTITATIVE', 'skala 1-10', 'TEKNIK'),
  ('Penilaian Mental', 'QUANTITATIVE', 'skala 1-10', 'MENTAL'),
  ('Penilaian Game Intelligence', 'QUANTITATIVE', 'skala 1-10', 'GAME_INTELLIGENCE')
ON CONFLICT DO NOTHING;

-- 3. Buat sesi latihan + kehadiran + penilaian otomatis
--    Script ini mengambil 1 coach (PELATIH/ADMIN) dan semua anggota yang bukan PELATIH/PEMBINA
DO $$
DECLARE
  coach_rec RECORD;
  athlete_rec RECORD;
  training_rec RECORD;
  session_id_1 UUID;
  session_id_2 UUID;
  session_id_3 UUID;
  metric_rec RECORD;
  score_val NUMERIC;
BEGIN
  -- Cari 1 coach (PELATIH atau ADMIN)
  SELECT id INTO coach_rec
  FROM public.profiles
  WHERE role IN ('PELATIH', 'ADMIN')
  LIMIT 1;

  IF coach_rec IS NULL THEN
    RAISE NOTICE 'Tidak ditemukan PELATIH/ADMIN. Skip sample data.';
    RETURN;
  END IF;

  RAISE NOTICE 'Coach ditemukan: %', coach_rec.id;

  -- Sesi 1: Sprint 100m (SPEED) — hari ini
  SELECT id INTO training_rec FROM public.trainings WHERE name = 'Sprint 100m';

  INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity)
  VALUES (coach_rec.id, training_rec.id, CURRENT_DATE, 'Sprint 100m', 60, 'HIGH')
  RETURNING id INTO session_id_1;

  RAISE NOTICE 'Sesi 1 dibuat: %', session_id_1;

  -- Sesi 2: Bench Press (STRENGTH) — besok
  SELECT id INTO training_rec FROM public.trainings WHERE name = 'Bench Press';

  INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity)
  VALUES (coach_rec.id, training_rec.id, CURRENT_DATE + INTERVAL '1 day', 'Bench Press', 45, 'MEDIUM')
  RETURNING id INTO session_id_2;

  RAISE NOTICE 'Sesi 2 dibuat: %', session_id_2;

  -- Sesi 3: Shuttle Run (AGILITY) — lusa
  SELECT id INTO training_rec FROM public.trainings WHERE name = 'Shuttle Run';

  INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity)
  VALUES (coach_rec.id, training_rec.id, CURRENT_DATE + INTERVAL '2 days', 'Shuttle Run', 30, 'HIGH')
  RETURNING id INTO session_id_3;

  RAISE NOTICE 'Sesi 3 dibuat: %', session_id_3;

  -- Tambah kehadiran + penilaian untuk setiap anggota
  FOR athlete_rec IN
    SELECT id, full_name FROM public.profiles
    WHERE role NOT IN ('PELATIH', 'PEMBINA')
    ORDER BY random()
    LIMIT 5
  LOOP
    RAISE NOTICE 'Memproses anggota: % (%)', athlete_rec.full_name, athlete_rec.id;

    -- Kehadiran Sesi 1 (SPEED)
    IF NOT EXISTS (SELECT 1 FROM public.training_session_attendants WHERE session_id = session_id_1 AND athlete_id = athlete_rec.id) THEN
      INSERT INTO public.training_session_attendants (session_id, athlete_id, method)
      VALUES (session_id_1, athlete_rec.id, 'MANUAL');
    END IF;

    -- Kehadiran Sesi 2 (STRENGTH)
    IF NOT EXISTS (SELECT 1 FROM public.training_session_attendants WHERE session_id = session_id_2 AND athlete_id = athlete_rec.id) THEN
      INSERT INTO public.training_session_attendants (session_id, athlete_id, method)
      VALUES (session_id_2, athlete_rec.id, 'MANUAL');
    END IF;

    -- Kehadiran Sesi 3 (AGILITY)
    IF NOT EXISTS (SELECT 1 FROM public.training_session_attendants WHERE session_id = session_id_3 AND athlete_id = athlete_rec.id) THEN
      INSERT INTO public.training_session_attendants (session_id, athlete_id, method)
      VALUES (session_id_3, athlete_rec.id, 'QR');
    END IF;

    -- Penilaian Sesi 1: SPEED
    SELECT id INTO metric_rec FROM public.athletic_metrics WHERE category = 'SPEED' LIMIT 1;
    score_val := (random() * 5 + 5)::NUMERIC(3,1); -- 5.0 - 10.0
    IF NOT EXISTS (SELECT 1 FROM public.assessments WHERE session_id = session_id_1 AND athlete_id = athlete_rec.id AND metric_id = metric_rec.id) THEN
      INSERT INTO public.assessments (session_id, athlete_id, metric_id, value, notes)
      VALUES (session_id_1, athlete_rec.id, metric_rec.id, score_val, 'Penilaian sprint');
    END IF;

    -- Penilaian Sesi 2: STRENGTH
    SELECT id INTO metric_rec FROM public.athletic_metrics WHERE category = 'STRENGTH' LIMIT 1;
    score_val := (random() * 5 + 5)::NUMERIC(3,1);
    IF NOT EXISTS (SELECT 1 FROM public.assessments WHERE session_id = session_id_2 AND athlete_id = athlete_rec.id AND metric_id = metric_rec.id) THEN
      INSERT INTO public.assessments (session_id, athlete_id, metric_id, value, notes)
      VALUES (session_id_2, athlete_rec.id, metric_rec.id, score_val, 'Penilaian bench press');
    END IF;

    -- Penilaian Sesi 3: AGILITY
    SELECT id INTO metric_rec FROM public.athletic_metrics WHERE category = 'AGILITY' LIMIT 1;
    score_val := (random() * 5 + 5)::NUMERIC(3,1);
    IF NOT EXISTS (SELECT 1 FROM public.assessments WHERE session_id = session_id_3 AND athlete_id = athlete_rec.id AND metric_id = metric_rec.id) THEN
      INSERT INTO public.assessments (session_id, athlete_id, metric_id, value, notes)
      VALUES (session_id_3, athlete_rec.id, metric_rec.id, score_val, 'Penilaian shuttle run');
    END IF;

  END LOOP;

  RAISE NOTICE '=== Sample data selesai! ===';
  RAISE NOTICE 'Buka /athletics → tab Matrik Performa → pilih atlet untuk lihat spider chart';
  RAISE NOTICE 'Buka /athletics → tab Sesi Latihan → klik Detail untuk lihat penilaian';
END $$;
