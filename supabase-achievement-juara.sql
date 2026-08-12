-- ============================================================================
-- A8: Achievement Juara - Enum Juara I/II/III/Harapan
-- Execute this in Supabase Dashboard SQL Editor
-- ============================================================================

-- 1. Buat enum type
CREATE TYPE public.achievement_juara AS ENUM ('JUARA_I', 'JUARA_II', 'JUARA_III', 'JUARA_HARAPAN');

-- 2. Ubah kolom juara pada achievement_participants menjadi enum
--    (nilai lama di-mapping ke enum; nilai yang tidak dikenali -> JUARA_HARAPAN)
ALTER TABLE public.achievement_participants
  ALTER COLUMN juara DROP DEFAULT,
  ALTER COLUMN juara TYPE public.achievement_juara
  USING (
    CASE
      WHEN upper(juara) IN ('JUARA I', 'JUARA 1', 'JUARA-1', 'J1', 'I', '1') THEN 'JUARA_I'::public.achievement_juara
      WHEN upper(juara) IN ('JUARA II', 'JUARA 2', 'JUARA-2', 'J2', 'II', '2') THEN 'JUARA_II'::public.achievement_juara
      WHEN upper(juara) IN ('JUARA III', 'JUARA 3', 'JUARA-3', 'J3', 'III', '3') THEN 'JUARA_III'::public.achievement_juara
      WHEN upper(juara) IN ('JUARA HARAPAN', 'HARAPAN') THEN 'JUARA_HARAPAN'::public.achievement_juara
      ELSE 'JUARA_HARAPAN'::public.achievement_juara
    END
  ),
  ALTER COLUMN juara SET DEFAULT 'JUARA_HARAPAN';
