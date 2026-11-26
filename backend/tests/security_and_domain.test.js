import test from 'node:test';
import assert from 'node:assert/strict';

// Configurar entorno de prueba aislado antes de importar módulos del servidor
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.SUPABASE_URL = 'https://dojo-test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key_non_prod_123456';
process.env.JWT_SECRET = 'test_jwt_secret_cryptographic_key_2026_dojo';

const { validateRequiredEnv } = await import('../config/env.js');
const { ROLES, STAFF_ROLES, ADMIN_ONLY, normalizeRole, hasRoleAccess } = await import(
  '../config/permissions.js'
);
const { authenticateToken, requireRole, generateToken } = await import('../middleware/auth.js');
const { verifyEmailFormat } = await import('../utils/emailVerification.js');
const { default: app } = await import('../server.js');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('validateRequiredEnv falla en arranque si faltan variables críticas o JWT inseguro', () => {
  assert.throws(
    () => validateRequiredEnv({ NODE_ENV: 'test', SUPABASE_URL: '', JWT_SECRET: 'abc' }),
    /Faltan variables de entorno críticas obligatorias/
  );

  assert.throws(
    () =>
      validateRequiredEnv({
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://ok.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'srv_key',
        JWT_SECRET: 'tu_clave_secreta_muy_segura_aqui_cambiar_por_una_real',
      }),
    /JWT_SECRET contiene un valor de ejemplo inseguro/
  );

  const cfg = validateRequiredEnv({
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://ok.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'srv_key',
    JWT_SECRET: 'clave_real_segura_32_caracteres_minimo',
  });
  assert.equal(cfg.supabaseUrl, 'https://ok.supabase.co');
});

test('normalizeRole y matriz RBAC homologan sensei -> instructor y bloquean escalamiento', () => {
  assert.equal(normalizeRole('sensei'), ROLES.INSTRUCTOR);
  assert.equal(normalizeRole('SENSEI'), ROLES.INSTRUCTOR);
  assert.equal(normalizeRole('rol_inexistente'), ROLES.USUARIO);
  assert.equal(normalizeRole(null), ROLES.USUARIO);

  assert.equal(hasRoleAccess('sensei', STAFF_ROLES), true);
  assert.equal(hasRoleAccess('usuario', STAFF_ROLES), false);
  assert.equal(hasRoleAccess('instructor', ADMIN_ONLY), false);
  assert.equal(hasRoleAccess('admin', ADMIN_ONLY), true);
});

test('authenticateToken distingue 401 TOKEN_REQUIRED / TOKEN_INVALID y requireRole devuelve 403 FORBIDDEN_ROLE', () => {
  // 1. Sin cabecera Authorization -> 401 TOKEN_REQUIRED
  const reqNoAuth = { headers: {} };
  const resNoAuth = createMockRes();
  let nextCalled = false;
  authenticateToken(reqNoAuth, resNoAuth, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(resNoAuth.statusCode, 401);
  assert.equal(resNoAuth.body?.code, 'TOKEN_REQUIRED');

  // 2. Token manipulado -> 401 TOKEN_INVALID
  const reqBadToken = { headers: { authorization: 'Bearer token.falso.invalido' } };
  const resBadToken = createMockRes();
  authenticateToken(reqBadToken, resBadToken, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(resBadToken.statusCode, 401);
  assert.equal(resBadToken.body?.code, 'TOKEN_INVALID');

  // 3. Token válido de rol "usuario" intentando ruta ADMIN_ONLY -> 403 FORBIDDEN_ROLE
  const userToken = generateToken({ id: 42, username: 'alumno1', rol: 'usuario' });
  const reqValidUser = { headers: { authorization: `Bearer ${userToken}` } };
  const resAuth = createMockRes();
  authenticateToken(reqValidUser, resAuth, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(reqValidUser.user.id, 42);
  assert.equal(reqValidUser.user.rol, 'usuario');

  const resForbidden = createMockRes();
  let adminNext = false;
  requireRole(ADMIN_ONLY)(reqValidUser, resForbidden, () => {
    adminNext = true;
  });
  assert.equal(adminNext, false);
  assert.equal(resForbidden.statusCode, 403);
  assert.equal(resForbidden.body?.code, 'FORBIDDEN_ROLE');
});

test('verifyEmailFormat rechaza correos desechables y formatos inválidos sin abrir sockets SMTP puerto 25', () => {
  assert.equal(verifyEmailFormat('invalido-sin-arroba').valid, false);
  assert.equal(verifyEmailFormat('usuario@yopmail.com').valid, false);
  assert.equal(verifyEmailFormat('atleta@10minutemail.com').valid, false);
  assert.equal(verifyEmailFormat('atleta@dojo-oficial.org').valid, true);
});

test('Integración HTTP Express: /api/health, eliminación de /debug/* y blindaje RBAC en endpoints críticos', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Healthcheck público + cabeceras Helmet
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.ok(healthRes.headers.get('x-content-type-options'), 'Helmet debe inyectar X-Content-Type-Options');

    // 2. Rutas sin token -> 401
    const noAuthBackup = await fetch(`${baseUrl}/api/backup/export/json`);
    assert.equal(noAuthBackup.status, 401);

    // 3. Usuario normal bloqueado con 403 en endpoints administrativos y de gestión
    const alumnoJwt = generateToken({ id: 99, username: 'alumno99', rol: 'usuario' });
    const headersAlumno = {
      Authorization: `Bearer ${alumnoJwt}`,
      'Content-Type': 'application/json',
    };

    const backupForbidden = await fetch(`${baseUrl}/api/backup/export/json`, { headers: headersAlumno });
    assert.equal(backupForbidden.status, 403);

    const usuariosForbidden = await fetch(`${baseUrl}/api/usuarios`, { headers: headersAlumno });
    assert.equal(usuariosForbidden.status, 403);

    const crearHorarioForbidden = await fetch(`${baseUrl}/api/horarios`, {
      method: 'POST',
      headers: headersAlumno,
      body: JSON.stringify({ dia_semana: 'Lunes', hora_inicio: '16:00', hora_fin: '17:00' }),
    });
    assert.equal(crearHorarioForbidden.status, 403);

    // 4. Endpoints /debug/* eliminados no existen
    const adminJwt = generateToken({ id: 1, username: 'admin', rol: 'admin' });
    const headersAdmin = { Authorization: `Bearer ${adminJwt}` };

    const debugPagos = await fetch(`${baseUrl}/api/pagos/debug/alumno/1`, { headers: headersAdmin });
    assert.equal(debugPagos.status, 404);

    const debugEval = await fetch(`${baseUrl}/api/evaluaciones/debug/usuario/1`, { headers: headersAdmin });
    assert.equal(debugEval.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
