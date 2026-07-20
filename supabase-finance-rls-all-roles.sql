-- ============================================================================
-- MIGRATION: Allow ALL roles to INSERT into finances table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "finances_insert_admin_core" ON public.finances;

-- Create new INSERT policy: ALL authenticated users can insert
CREATE POLICY "finances_insert_all_roles"
    ON public.finances FOR INSERT
    TO authenticated
    WITH CHECK (true);
