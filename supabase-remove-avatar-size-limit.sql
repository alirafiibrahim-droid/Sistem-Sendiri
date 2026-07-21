-- ============================================================================
-- MIGRATION: Hapus file_size_limit pada bucket avatars (tanpa batas ukuran)
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'avatars';
