-- ============================================================================
-- MIGRACIÓN 3: MÓDULO DE ASISTENCIAS Y SOPORTE COMPLETO DE HORARIOS/PROMOCIONES
-- Sistema de Gestión de Dojo (PostgreSQL / Supabase)
-- ============================================================================

BEGIN;

-- 1. Asegurar columna instructor_id en horarios_clases para despliegues previos
ALTER TABLE public.horarios_clases
  ADD COLUMN IF NOT EXISTS instructor_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL;

-- 2. Tabla de control de asistencia por clase y fecha
CREATE TABLE IF NOT EXISTS public.asistencias (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  id_horario BIGINT NOT NULL REFERENCES public.horarios_clases(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('presente', 'ausente', 'tardanza', 'justificado')),
  observaciones TEXT,
  registrado_por BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_alumno, id_horario, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_fecha_horario
  ON public.asistencias (fecha DESC, id_horario);

CREATE INDEX IF NOT EXISTS idx_asistencias_alumno_fecha
  ON public.asistencias (id_alumno, fecha DESC);

-- 3. Seguridad RLS estricta (solo backend con service_role)
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.asistencias FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.asistencias TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.asistencias_id_seq TO service_role;

DROP POLICY IF EXISTS "service_role_all_asistencias" ON public.asistencias;
CREATE POLICY "service_role_all_asistencias"
  ON public.asistencias
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
