-- Hapus policy lama (hanya ADMIN/PENGURUS_INTI/KABID)
DROP POLICY IF EXISTS "programs_insert_admin_core_kabid" ON public.programs;

-- Buat policy baru: semua user terautentikasi bisa insert
CREATE POLICY "programs_insert_authenticated"
    ON public.programs FOR INSERT
    TO authenticated
    WITH CHECK (true);
