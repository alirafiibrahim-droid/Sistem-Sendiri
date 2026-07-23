-- ============================================================================
-- Migration: Update achievement_participants
-- Ganti role_in_achievement → juara + keterangan
-- ============================================================================

-- Drop kolom lama
ALTER TABLE public.achievement_participants
  DROP COLUMN IF EXISTS role_in_achievement;

-- Tambah kolom baru
ALTER TABLE public.achievement_participants
  ADD COLUMN juara VARCHAR(50) NOT NULL DEFAULT '',
  ADD COLUMN keterangan TEXT;

-- Update UNIQUE constraint (achievement_id + user_id tetap)
-- Tidak perlu diubah, sudah ada
