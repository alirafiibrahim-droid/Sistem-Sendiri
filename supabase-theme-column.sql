-- ============================================================================
-- MIGRATION: profiles theme column
-- Menyimpan tema tampilan (colour plate) pilihan tiap pengguna.
-- Nilai default = 'default' (tema saat ini / Default Saat Ini).
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS theme VARCHAR(50) NOT NULL DEFAULT 'default';

UPDATE public.profiles SET theme = 'default' WHERE theme IS NULL OR theme = '';
