-- ============================================================================
-- MIGRATION: Izinkan ADMIN upload logo organisasi ke folder org/ di bucket avatars
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- Policy: ADMIN bisa upload ke folder org/ di bucket avatars
CREATE POLICY "avatars_upload_org_admin"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'org'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- Policy: ADMIN bisa update (upsert) file di folder org/
CREATE POLICY "avatars_update_org_admin"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'org'
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
    );
