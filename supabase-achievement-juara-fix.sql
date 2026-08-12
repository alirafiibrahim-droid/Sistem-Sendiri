-- ============================================================================
-- FIX: Kolom 'juara' pada tabel achievements tidak ditemukan
--   Error: "Could not find the 'juara' column of 'achievements' in the schema cache"
-- Jalankan di Supabase Dashboard > SQL Editor, lalu muat ulang halaman.
-- ============================================================================

-- 1. Pastikan enum achievement_juara ada (bila belum pernah dibuat)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'achievement_juara') THEN
        CREATE TYPE public.achievement_juara AS ENUM ('JUARA_I', 'JUARA_II', 'JUARA_III', 'JUARA_HARAPAN');
    END IF;
END $$;

-- 2. Tambahkan kolom juara ke tabel achievements (juara prestasi tipe ORGANIZATION)
ALTER TABLE public.achievements
    ADD COLUMN IF NOT EXISTS juara public.achievement_juara;

-- 3. Kolom juara pada achievement_participants harus nullable
--    (prestasi ORGANIZATION: peserta tidak membawa juara masing-masing)
ALTER TABLE public.achievement_participants
    ALTER COLUMN juara DROP NOT NULL;

-- 4. Refresh schema cache PostgREST agar kolom baru langsung dikenali
NOTIFY pgrst, 'reload schema';
