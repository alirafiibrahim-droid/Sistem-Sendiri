-- ============================================================================
-- Migration: Fix FK constraints untuk PostgREST joins ke profiles
-- Problem: created_by/user_id REFERENCES auth.users(id), tapi PostgREST 
--          join ke public.profiles(id) → relasi tidak ditemukan
-- ============================================================================

-- 1. achievements.created_by → profiles(id)
ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_created_by_fkey;

ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. achievement_participants.user_id → profiles(id)
ALTER TABLE public.achievement_participants
  DROP CONSTRAINT IF EXISTS achievement_participants_user_id_fkey;

ALTER TABLE public.achievement_participants
  ADD CONSTRAINT achievement_participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Jalankan RLS policies untuk achievement_participants (jika belum ada)
-- dari file supabase-achievements-rls-fix.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'achievement_participants_select_all'
  ) THEN
    CREATE POLICY "achievement_participants_select_all"
        ON public.achievement_participants FOR SELECT
        TO authenticated
        USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'achievement_participants_insert_auth'
  ) THEN
    CREATE POLICY "achievement_participants_insert_auth"
        ON public.achievement_participants FOR INSERT
        TO authenticated
        WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'achievement_participants_delete_core'
  ) THEN
    CREATE POLICY "achievement_participants_delete_core"
        ON public.achievement_participants FOR DELETE
        TO authenticated
        USING (
            (SELECT role FROM public.profiles WHERE id = auth.uid())
            IN ('ADMIN', 'PENGURUS_INTI')
        );
  END IF;
END $$;
