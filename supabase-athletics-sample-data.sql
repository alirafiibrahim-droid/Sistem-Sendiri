-- ============================================================================
-- SAMPLE DATA: Athletics V2 — for testing
-- Ganti '<user-uuid>' dengan UUID asli dari profiles/auth.users
-- ============================================================================

-- 1. Seed trainings (master data latihan)
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

-- 2. Contoh sesi latihan (ganti coach_id dengan UUID pelatih asli)
-- Jalankan ini SETELAH mengetahui UUID coach dan athlete dari database:
--
-- Contoh mencari UUID:
--   SELECT id, full_name, role FROM public.profiles WHERE role IN ('PELATIH', 'ANGGOTA');
--
-- INSERT contoh sesi:
-- INSERT INTO public.training_sessions (coach_id, training_id, date, session_type, duration_minutes, intensity)
-- VALUES (
--   '<coach-uuid>',
--   (SELECT id FROM public.trainings WHERE name = 'Sprint 100m'),
--   CURRENT_DATE,
--   'Sprint 100m',
--   60,
--   'HIGH'
-- );
--
-- INSERT kehadiran:
-- INSERT INTO public.training_session_attendants (session_id, athlete_id, method)
-- VALUES (
--   (SELECT id FROM public.training_sessions ORDER BY created_at DESC LIMIT 1),
--   '<athlete-uuid>',
--   'MANUAL'
-- );
