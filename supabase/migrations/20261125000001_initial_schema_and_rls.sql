-- ============================================================================
-- MIGRACIÓN BASE + POLÍTICAS ESTRICTAS DE ROW LEVEL SECURITY (RLS)
-- Sistema de Gestión de Dojo (PostgreSQL / Supabase)
-- ============================================================================
-- Arquitectura de seguridad:
-- El frontend NUNCA accede directamente a Supabase. Todas las operaciones pasan
-- por el backend Express autenticado (JWT + RBAC), el cual se conecta mediante
-- SUPABASE_SERVICE_ROLE_KEY. Por principio de mínimo privilegio:
--   1. Se habilita RLS en TODAS las tablas del esquema public.
--   2. Se revocan todos los privilegios directos de los roles `anon` y `authenticated`.
--   3. Se otorgan permisos únicamente a `service_role`.
-- ============================================================================

BEGIN;

-- 1. Usuarios y seguridad de acceso
CREATE TABLE IF NOT EXISTS public.usuario (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre_completo VARCHAR(150) NOT NULL,
  rol VARCHAR(30) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'instructor', 'recepcionista', 'asistente', 'usuario')),
  estado BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  idioma_preferido VARCHAR(5) NOT NULL DEFAULT 'es',
  ultimo_acceso TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_lock (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL UNIQUE REFERENCES public.usuario(id) ON DELETE CASCADE,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
  bloqueado_desde TIMESTAMPTZ,
  codigo_desbloqueo VARCHAR(6),
  codigo_expires_at TIMESTAMPTZ,
  codigo_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  codigo VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Catálogos académicos (Categorías de edad y Cintas)
CREATE TABLE IF NOT EXISTS public.categorias_edad (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  edad_min INTEGER NOT NULL CHECK (edad_min >= 0),
  edad_max INTEGER NOT NULL CHECK (edad_max >= edad_min),
  precio_mensualidad NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
  cinta_maxima VARCHAR(40),
  orden INTEGER NOT NULL DEFAULT 99,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cintas (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  nombre_en VARCHAR(50),
  color_hex VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
  orden INTEGER NOT NULL DEFAULT 99,
  es_dan BOOLEAN NOT NULL DEFAULT FALSE,
  nivel_dan INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Representantes y Alumnos
CREATE TABLE IF NOT EXISTS public.representante (
  id BIGSERIAL PRIMARY KEY,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  apellido VARCHAR(120),
  telefono VARCHAR(30),
  email VARCHAR(150),
  direccion TEXT,
  parentesco VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumno (
  id BIGSERIAL PRIMARY KEY,
  cedula VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  estado BOOLEAN NOT NULL DEFAULT TRUE,
  id_categoria_edad BIGINT REFERENCES public.categorias_edad(id) ON DELETE SET NULL,
  id_cinta BIGINT REFERENCES public.cintas(id) ON DELETE SET NULL,
  usuario_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  sensei_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  telefono VARCHAR(30),
  email VARCHAR(150),
  direccion TEXT,
  contacto_emergencia VARCHAR(150),
  telefono_emergencia VARCHAR(30),
  nombre_padre VARCHAR(150),
  telefono_padre VARCHAR(30),
  nombre_madre VARCHAR(150),
  telefono_madre VARCHAR(30),
  precio_personalizado NUMERIC(10, 2),
  descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0,
  observaciones_pago TEXT,
  tiempo_preparacion_meses INTEGER,
  proximo_examen_fecha DATE,
  fecha_inscripcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumnorepresentante (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  id_representante BIGINT NOT NULL REFERENCES public.representante(id) ON DELETE CASCADE,
  UNIQUE (id_alumno, id_representante)
);

CREATE TABLE IF NOT EXISTS public.alumnotelefono (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  telefono VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.alumnodireccion (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  direccion TEXT NOT NULL
);

-- 4. Horarios y Días Festivos
CREATE TABLE IF NOT EXISTS public.horarios_clases (
  id BIGSERIAL PRIMARY KEY,
  dia_semana VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  id_categoria_edad BIGINT REFERENCES public.categorias_edad(id) ON DELETE SET NULL,
  instructor_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  instructor VARCHAR(150),
  capacidad_maxima INTEGER DEFAULT 20,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dias_festivos (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  descripcion VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Evaluaciones y Resultados
CREATE TABLE IF NOT EXISTS public.evaluacion (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME,
  descripcion TEXT,
  instructor_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alumnoevaluacion (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  id_evaluacion BIGINT NOT NULL REFERENCES public.evaluacion(id) ON DELETE CASCADE,
  aprobado BOOLEAN,
  notas TEXT,
  cinta_anterior_id BIGINT REFERENCES public.cintas(id) ON DELETE SET NULL,
  cinta_nueva_id BIGINT REFERENCES public.cintas(id) ON DELETE SET NULL,
  fecha_evaluacion TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_alumno, id_evaluacion)
);

-- 6. Pagos y Configuración
CREATE TABLE IF NOT EXISTS public.pagos (
  id BIGSERIAL PRIMARY KEY,
  id_alumno BIGINT NOT NULL REFERENCES public.alumno(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL CHECK (anio >= 2000),
  monto NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  moneda VARCHAR(10) DEFAULT 'USD$',
  tasa_cambio NUMERIC(12, 4),
  metodo_pago VARCHAR(50) NOT NULL,
  fecha_pago DATE NOT NULL,
  mes_correspondiente VARCHAR(60),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'rechazado')),
  referencia VARCHAR(50),
  banco_origen VARCHAR(100),
  cedula_titular VARCHAR(30),
  telefono_cuenta VARCHAR(30),
  comprobante TEXT,
  observaciones TEXT,
  motivo_rechazo TEXT,
  registrado_por BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  verificado_por BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  fecha_verificacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.config_pagos (
  id BIGINT PRIMARY KEY DEFAULT 1,
  dia_corte INTEGER NOT NULL DEFAULT 5 CHECK (dia_corte BETWEEN 1 AND 31),
  descuento_pago_adelantado NUMERIC(5, 2) NOT NULL DEFAULT 0,
  costo_inscripcion NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  moneda VARCHAR(10) NOT NULL DEFAULT 'USD$',
  metodos_pago TEXT,
  datos_bancarios TEXT,
  idioma_sistema VARCHAR(5) DEFAULT 'es',
  pais_configuracion VARCHAR(30) DEFAULT 'venezuela',
  tipo_cambio_usd_bs NUMERIC(12, 4) NOT NULL DEFAULT 220.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.configuracion (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(100) NOT NULL UNIQUE,
  valor TEXT,
  tipo VARCHAR(30) DEFAULT 'texto',
  descripcion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.log_actividades (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES public.usuario(id) ON DELETE SET NULL,
  accion VARCHAR(50) NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  descripcion TEXT,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Índices de rendimiento en claves foráneas y búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_alumno_usuario_id ON public.alumno(usuario_id);
CREATE INDEX IF NOT EXISTS idx_alumno_sensei_id ON public.alumno(sensei_id);
CREATE INDEX IF NOT EXISTS idx_alumno_categoria_cinta ON public.alumno(id_categoria_edad, id_cinta);
CREATE INDEX IF NOT EXISTS idx_alumnorepresentante_alumno ON public.alumnorepresentante(id_alumno);
CREATE INDEX IF NOT EXISTS idx_alumnorepresentante_rep ON public.alumnorepresentante(id_representante);
CREATE INDEX IF NOT EXISTS idx_email_verification_usuario_used ON public.email_verification_codes(usuario_id, used);
CREATE INDEX IF NOT EXISTS idx_password_reset_usuario_used ON public.password_reset_tokens(usuario_id, used);
CREATE INDEX IF NOT EXISTS idx_pagos_alumno_periodo ON public.pagos(id_alumno, anio, mes);
CREATE INDEX IF NOT EXISTS idx_pagos_estado_fecha ON public.pagos(estado, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_alumnoevaluacion_evaluacion ON public.alumnoevaluacion(id_evaluacion);
CREATE INDEX IF NOT EXISTS idx_alumnoevaluacion_alumno ON public.alumnoevaluacion(id_alumno);
CREATE INDEX IF NOT EXISTS idx_log_actividades_created_at ON public.log_actividades(created_at DESC);

-- 8. Función de mantenimiento de códigos expirados
CREATE OR REPLACE FUNCTION public.limpiar_codigos_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW() AND used = FALSE;

  DELETE FROM public.password_reset_tokens
  WHERE expires_at < NOW() AND used = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_codigos_expirados() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_codigos_expirados() TO service_role;

-- 9. REVOCAR ACCESO ANÓNIMO / AUTENTICADO DIRECTO Y HABILITAR RLS ESTRICTO EN TODO PUBLIC
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

DO $$
DECLARE
  tbl RECORD;
  policy_name TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);

    policy_name := format('service_role_all_%s', tbl.tablename);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl.tablename
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        policy_name,
        tbl.tablename
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
