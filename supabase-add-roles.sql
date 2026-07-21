-- ============================================================================
-- MIGRATION: Tambah Role Ketua Umum, Wakil Ketua, Sekretaris, Bendahara
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Tambah enum values baru
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'KETUA_UMUM' AFTER 'ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'WAKIL_KETUA' AFTER 'KETUA_UMUM';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SEKRETARIS' AFTER 'PENGURUS_INTI';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'BENDAHARA' AFTER 'SEKRETARIS';
