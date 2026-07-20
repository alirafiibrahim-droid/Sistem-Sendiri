-- ============================================================================
-- MIGRATION: Fix finances → profiles relationship for Supabase ORM joins
-- Ubah FK finances.created_by dari auth.users ke profiles
-- sehingga .select("*, profiles(id, full_name)") bisa bekerja
-- ============================================================================

-- 1. Hapus data orphan: created_by yang ada di finances tapi tidak ada di profiles
DELETE FROM public.finances
WHERE created_by IS NOT NULL
  AND created_by NOT IN (SELECT id FROM public.profiles);

-- 2. Hapus FK lama yang mengacu ke auth.users
ALTER TABLE public.finances
  DROP CONSTRAINT IF EXISTS finances_created_by_fkey;

-- 3. Tambah FK baru yang mengacu ke profiles.id
--    (profiles.id sendiri sudah REFERENCES auth.users.id, jadi integritas terjaga)
ALTER TABLE public.finances
  ADD CONSTRAINT finances_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- 4. Refresh schema cache Supabase (akan otomatis dalam beberapa menit,
--    atau bisa refresh paksa di Dashboard > SQL Editor dengan query ini)
NOTIFY pgrst, 'reload schema';
