-- ============================================================================
-- NOTA: Este script legado ha sido reemplazado por las migraciones ordenadas en:
--   supabase/migrations/20261125000001_initial_schema_and_rls.sql
-- Se mantiene únicamente como referencia segura con RLS estricto habilitado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  codigo VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_usuario_used
  ON public.email_verification_codes(usuario_id, used);

-- Habilitar Row Level Security y revocar cualquier acceso directo a roles públicos
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_verification_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.email_verification_codes_id_seq FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.email_verification_codes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.email_verification_codes_id_seq TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_verification_codes'
      AND policyname = 'service_role_all_email_verification_codes'
  ) THEN
    CREATE POLICY service_role_all_email_verification_codes
      ON public.email_verification_codes
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
