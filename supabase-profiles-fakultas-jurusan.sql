-- ============================================================================
-- MIGRATION: Tambah kolom fakultas_id & jurusan_id ke tabel profiles
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Tambah kolom fakultas_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fakultas_id UUID REFERENCES public.fakultas(id) ON DELETE SET NULL;

-- 2. Tambah kolom jurusan_id
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jurusan_id UUID REFERENCES public.jurusan(id) ON DELETE SET NULL;

-- 3. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_profiles_fakultas ON public.profiles(fakultas_id);
CREATE INDEX IF NOT EXISTS idx_profiles_jurusan ON public.profiles(jurusan_id);

-- 4. RLS: Izinkan semua user terautentikasi untuk UPDATE profiles
--    (otorisasi sudah ditangani oleh API handler, bukan oleh RLS)
DROP POLICY IF EXISTS "profiles_update_all_auth" ON public.profiles;
CREATE POLICY "profiles_update_all_auth"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Update trigger handle_new_user() untuk menyalin fakultas_id & jurusan_id
--    dari user metadata saat user baru dibuat
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
