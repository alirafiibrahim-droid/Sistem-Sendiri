-- ============================================================================
-- Kode Unit Sesi — Kode unik 7 karakter (huruf & angka, uppercase) per sesi
-- Digunakan untuk absensi MANUAL: peserta wajib memasukkan kode ini.
-- Execute this in Supabase Dashboard SQL Editor
-- ============================================================================

-- 1. Tambahkan kolom session_code pada ketiga tabel sesi
ALTER TABLE public.program_sessions
    ADD COLUMN IF NOT EXISTS session_code VARCHAR(7);

ALTER TABLE public.training_sessions
    ADD COLUMN IF NOT EXISTS session_code VARCHAR(7);

ALTER TABLE public.project_sessions
    ADD COLUMN IF NOT EXISTS session_code VARCHAR(7);

-- 2. Backfill kode unik untuk baris yang sudah ada (sebelum dijadikan NOT NULL)
--    Alfabet tanpa karakter ambigu: A-Z minus I/L/O + angka 2-9 (total 31)
DO $$
DECLARE
    r        record;
    new_code text;
    done     boolean;
BEGIN
    FOR r IN SELECT id FROM public.program_sessions WHERE session_code IS NULL LOOP
        done := false;
        WHILE NOT done LOOP
            SELECT string_agg(
                substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
                ''
            )
            INTO new_code
            FROM generate_series(1, 7);
            BEGIN
                UPDATE public.program_sessions SET session_code = new_code WHERE id = r.id;
                done := true;
            EXCEPTION WHEN unique_violation THEN
                done := false;
            END;
        END LOOP;
    END LOOP;
END $$;

DO $$
DECLARE
    r        record;
    new_code text;
    done     boolean;
BEGIN
    FOR r IN SELECT id FROM public.training_sessions WHERE session_code IS NULL LOOP
        done := false;
        WHILE NOT done LOOP
            SELECT string_agg(
                substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
                ''
            )
            INTO new_code
            FROM generate_series(1, 7);
            BEGIN
                UPDATE public.training_sessions SET session_code = new_code WHERE id = r.id;
                done := true;
            EXCEPTION WHEN unique_violation THEN
                done := false;
            END;
        END LOOP;
    END LOOP;
END $$;

DO $$
DECLARE
    r        record;
    new_code text;
    done     boolean;
BEGIN
    FOR r IN SELECT id FROM public.project_sessions WHERE session_code IS NULL LOOP
        done := false;
        WHILE NOT done LOOP
            SELECT string_agg(
                substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
                ''
            )
            INTO new_code
            FROM generate_series(1, 7);
            BEGIN
                UPDATE public.project_sessions SET session_code = new_code WHERE id = r.id;
                done := true;
            EXCEPTION WHEN unique_violation THEN
                done := false;
            END;
        END LOOP;
    END LOOP;
END $$;

-- 3. Jadikan NOT NULL dan tambahkan unique index
ALTER TABLE public.program_sessions
    ALTER COLUMN session_code SET NOT NULL;

ALTER TABLE public.training_sessions
    ALTER COLUMN session_code SET NOT NULL;

ALTER TABLE public.project_sessions
    ALTER COLUMN session_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_program_sessions_session_code
    ON public.program_sessions(session_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_session_code
    ON public.training_sessions(session_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_sessions_session_code
    ON public.project_sessions(session_code);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
