# Sistema de Gestión de Dojo

Plataforma web Full-Stack para la administración integral de un Dojo de artes marciales: inscripción y ficha médica/familiar de alumnos, representantes legales para menores de edad, jerarquía oficial de cintas y categorías de edad, horarios semanales y días festivos, control de asistencia por sesión, exámenes con ascenso automático de cinta, verificación administrativa de mensualidades (`USD$` / `Bs.`), respaldos PostgreSQL y bitácora de auditoría.

---

## Arquitectura Tecnológica

- **Frontend:** React 18, TypeScript (`strict: true`), Vite 5, Tailwind CSS, shadcn/ui (Radix UI), React Hook Form + Zod.
- **Backend / API:** Node.js + Express (`backend/` y adaptador serverless `api/index.js` para Vercel), validación con `express-validator`, cabeceras `helmet` y protección anti-fuerza bruta con `express-rate-limit`.
- **Base de Datos y Seguridad:** PostgreSQL en **Supabase** con **Row Level Security (RLS)** habilitado en todas las tablas y acceso revocado a `anon` / `authenticated` (toda operación pasa por el backend autenticado mediante JWT y matriz RBAC).

---

## Requisitos Previos

- **Node.js** `>= 18.18.0` (recomendado Node 20 LTS) y `npm`.
- Proyecto activo en **Supabase** (PostgreSQL 15+).
- Cuenta SMTP (opcional pero recomendada para envío de códigos OTP de verificación de correo, recuperación de contraseña y desbloqueo de cuenta).

---

## Configuración Paso a Paso

### 1. Instalar dependencias

```bash
npm run install:all
```

### 2. Configurar variables de entorno

Copia las plantillas `.env.example` y completa tus credenciales reales (el backend falla de forma segura al arrancar si faltan variables críticas):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Variables obligatorias en `backend/.env`:

| Variable | Descripción |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role` de Supabase (exclusiva del servidor, nunca exponer en frontend) |
| `JWT_SECRET` | Secreto criptográfico único de al menos 32 caracteres aleatorios |
| `PORT` | Puerto local de la API (por defecto `3001`) |
| `FRONTEND_URL` | Origen permitido por CORS (por defecto `http://localhost:8080`) |
| `EMAIL_USER` / `EMAIL_PASS` | Credenciales SMTP para envío de códigos OTP y recuperación |

Variables en `.env` (raíz, frontend):

| Variable | Descripción |
| --- | --- |
| `VITE_API_URL` | URL base del backend (ej. `http://localhost:3001/api` o `/api` con el proxy de Vite) |

### 3. Aplicar migraciones SQL en Supabase

Ejecuta en orden estricto los scripts ubicados en `supabase/migrations/` desde el **SQL Editor** de Supabase (o mediante `supabase db push`):

1. `supabase/migrations/20261125000001_initial_schema_and_rls.sql` — Esquema relacional completo, índices y políticas estrictas RLS.
2. `supabase/migrations/20261125000002_schema_integrity_and_missing_columns.sql` — Normalización de tipos `BOOLEAN`, columnas extendidas y semillas idempotentes de cintas (`Blanco` → `Negro`) y categorías de edad (`Benjamín` → `Veterano`).
3. `supabase/migrations/20261125000003_attendance_and_promotions.sql` — Tabla `public.asistencias`, índices y políticas RLS del módulo de asistencia.

---

## Matriz de Roles y Permisos (RBAC)

| Módulo / Acción | `admin` | `instructor` | `asistente` | `recepcionista` | `usuario` (Alumno) |
| --- | :---: | :---: | :---: | :---: | :---: |
| Panel Principal (`/`) | Global | Global | Global | Operativo | Propio + Inscripción |
| Alumnos y Representantes | CRUD + Eliminar | Crear / Editar | Crear / Editar | Crear / Editar | Solo lectura propia (anti-IDOR) |
| Categorías de Edad y Cintas | CRUD + Eliminar | Crear / Editar | Crear / Editar | Lectura | Lectura |
| Horarios y Días Festivos | CRUD completo | CRUD completo | Lectura | Lectura | Lectura filtrada por categoría |
| Control de Asistencias | Pase de lista + Resumen | Pase de lista + Resumen | Pase de lista + Resumen | Pase de lista + Resumen | Resumen e historial propio |
| Evaluaciones y Ascensos | CRUD + Calificar + Eliminar | Crear + Editar + Calificar | Crear + Editar + Calificar | — | Consulta de sus exámenes y resultados |
| Pagos y Mensualidades | Caja + Confirmar/Rechazar + Tarifas | Consulta | Consulta | Caja + Confirmar/Rechazar | Reportar pago (`pendiente`) + Historial propio |
| Reportes y Estadísticas | Completo | Completo | — | — | — |
| Administración Avanzada (Usuarios, Respaldos, Logs) | Exclusivo | — | — | — | — |

---

## Ejecución en Desarrollo y Verificación

```bash
# Levantar simultáneamente API (puerto 3001) y Frontend Vite (puerto 8080 con proxy /api)
npm run dev:full

# Ejecutar suite automatizada de pruebas de seguridad y dominio (Backend)
npm test

# Verificación estricta de tipos TypeScript (strict + noImplicitAny)
npm run typecheck

# Linter estático ESLint
npm run lint

# Compilación de producción del Frontend
npm run build
```

---

## Despliegue en Vercel

El repositorio incluye `vercel.json` y el punto de entrada serverless `api/index.js`:

1. Conecta el repositorio en Vercel.
2. Configura en **Project Settings → Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `FRONTEND_URL`, `EMAIL_USER`, `EMAIL_PASS` y `VITE_API_URL=/api`.
3. Despliega la rama `main`.
