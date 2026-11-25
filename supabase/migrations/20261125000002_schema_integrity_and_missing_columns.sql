-- ============================================================================
-- MIGRACIÓN 2: INTEGRIDAD DE ESQUEMA, COLUMNAS FALTANTES Y NORMALIZACIÓN BOOLEANA
-- Sistema de Gestión de Dojo (PostgreSQL / Supabase)
-- ============================================================================

BEGIN;

-- 1. Asegurar columnas completas en public.representante
ALTER TABLE public.representante
  ADD COLUMN IF NOT EXISTS apellido VARCHAR(120),
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS parentesco VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Asegurar columnas completas en public.alumno
ALTER TABLE public.alumno
  ADD COLUMN IF NOT EXISTS sensei_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacto_emergencia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nombre_padre VARCHAR(150),
  ADD COLUMN IF NOT EXISTS telefono_padre VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nombre_madre VARCHAR(150),
  ADD COLUMN IF NOT EXISTS telefono_madre VARCHAR(30),
  ADD COLUMN IF NOT EXISTS precio_personalizado NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observaciones_pago TEXT,
  ADD COLUMN IF NOT EXISTS tiempo_preparacion_meses INTEGER,
  ADD COLUMN IF NOT EXISTS proximo_examen_fecha DATE,
  ADD COLUMN IF NOT EXISTS fecha_inscripcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Asegurar columnas completas en public.evaluacion y public.alumnoevaluacion
ALTER TABLE public.evaluacion
  ADD COLUMN IF NOT EXISTS hora TIME,
  ADD COLUMN IF NOT EXISTS instructor_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.alumnoevaluacion
  ADD COLUMN IF NOT EXISTS aprobado BOOLEAN,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS cinta_anterior_id BIGINT REFERENCES public.cintas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cinta_nueva_id BIGINT REFERENCES public.cintas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_evaluacion TIMESTAMPTZ DEFAULT NOW();

-- 4. Asegurar columnas completas en catálogos y pagos
ALTER TABLE public.categorias_edad
  ADD COLUMN IF NOT EXISTS cinta_maxima VARCHAR(40),
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 99;

ALTER TABLE public.cintas
  ADD COLUMN IF NOT EXISTS nombre_en VARCHAR(50),
  ADD COLUMN IF NOT EXISTS color_hex VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS es_dan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nivel_dan INTEGER;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'USD$',
  ADD COLUMN IF NOT EXISTS tasa_cambio NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS verificado_por BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_verificacion TIMESTAMPTZ;

ALTER TABLE public.config_pagos
  ADD COLUMN IF NOT EXISTS costo_inscripcion NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS pais_configuracion VARCHAR(30) DEFAULT 'venezuela',
  ADD COLUMN IF NOT EXISTS tipo_cambio_usd_bs NUMERIC(12, 4) NOT NULL DEFAULT 220.00;

-- 5. Normalización segura de columnas booleanas si venían como SMALLINT/INTEGER
DO $$
DECLARE
  col_record RECORD;
BEGIN
  FOR col_record IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'usuario' AND column_name IN ('estado', 'activo', 'email_verificado')) OR
        (table_name = 'alumno' AND column_name = 'estado') OR
        (table_name = 'cintas' AND column_name = 'es_dan') OR
        (table_name = 'horarios_clases' AND column_name = 'activo') OR
        (table_name = 'password_reset_tokens' AND column_name = 'used') OR
        (table_name = 'email_verification_codes' AND column_name = 'used') OR
        (table_name = 'account_lock' AND column_name IN ('bloqueado', 'codigo_used'))
      )
      AND data_type IN ('smallint', 'integer', 'bigint')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT, ALTER COLUMN %I TYPE BOOLEAN USING (%I <> 0)',
      col_record.table_name,
      col_record.column_name,
      col_record.column_name,
      col_record.column_name
    );
  END LOOP;
END $$;

ALTER TABLE public.usuario
  ALTER COLUMN estado SET DEFAULT FALSE,
  ALTER COLUMN activo SET DEFAULT FALSE,
  ALTER COLUMN email_verificado SET DEFAULT FALSE;

ALTER TABLE public.alumno
  ALTER COLUMN estado SET DEFAULT TRUE;

ALTER TABLE public.cintas
  ALTER COLUMN es_dan SET DEFAULT FALSE;

ALTER TABLE public.horarios_clases
  ALTER COLUMN activo SET DEFAULT TRUE;

ALTER TABLE public.password_reset_tokens
  ALTER COLUMN used SET DEFAULT FALSE;

ALTER TABLE public.email_verification_codes
  ALTER COLUMN used SET DEFAULT FALSE;

-- 6. Semillas base idempotentes para categorías de edad y cintas oficiales
INSERT INTO public.cintas (nombre, nombre_en, color_hex, orden, es_dan, nivel_dan)
VALUES
  ('Blanco', 'White', '#FFFFFF', 1, FALSE, NULL),
  ('Amarillo', 'Yellow', '#FACC15', 2, FALSE, NULL),
  ('Naranja', 'Orange', '#FB923C', 3, FALSE, NULL),
  ('Verde', 'Green', '#22C55E', 4, FALSE, NULL),
  ('Azul', 'Blue', '#2563EB', 5, FALSE, NULL),
  ('Marrón', 'Brown', '#78350F', 6, FALSE, NULL),
  ('Negro', 'Black', '#18181B', 7, TRUE, 1)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.categorias_edad (nombre, edad_min, edad_max, precio_mensualidad, cinta_maxima, orden)
VALUES
  ('Benjamín', 6, 8, 40.00, 'Verde', 1),
  ('Alevín', 9, 10, 45.00, 'Azul', 2),
  ('Infantil', 11, 12, 45.00, 'Azul', 3),
  ('Cadete', 13, 15, 50.00, 'Marrón', 4),
  ('Junior', 16, 17, 50.00, 'Negro', 5),
  ('Senior', 18, 34, 55.00, 'Negro', 6),
  ('Veterano', 35, 99, 55.00, 'Negro', 7)
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
