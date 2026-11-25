import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar backend/.env primero y luego .env de la raíz como respaldo local
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'tu_clave_secreta_muy_segura_aqui_cambiar_por_una_real',
  'changeme',
  'secret',
]);

export function validateRequiredEnv(env = process.env) {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
  const missing = requiredVars.filter((key) => !env[key] || String(env[key]).trim() === '');

  if (missing.length > 0) {
    const message = `Faltan variables de entorno críticas obligatorias: ${missing.join(', ')}. Configúralas en backend/.env o en el panel de despliegue.`;
    console.error(`❌ ERROR CRÍTICO DE CONFIGURACIÓN: ${message}`);
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(message);
  }

  if (INSECURE_JWT_PLACEHOLDERS.has(String(env.JWT_SECRET).trim())) {
    const message = 'JWT_SECRET contiene un valor de ejemplo inseguro. Define un secreto criptográfico único.';
    console.error(`❌ ERROR CRÍTICO DE CONFIGURACIÓN: ${message}`);
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(message);
  }

  return {
    supabaseUrl: String(env.SUPABASE_URL).trim(),
    supabaseServiceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY).trim(),
    jwtSecret: String(env.JWT_SECRET).trim(),
    port: Number(env.PORT) || 3001,
    frontendUrl: env.FRONTEND_URL || 'http://localhost:8080',
    corsOrigin: env.CORS_ORIGIN || '',
    emailUser: env.EMAIL_USER ? String(env.EMAIL_USER).trim() : '',
    emailPass: env.EMAIL_PASS ? String(env.EMAIL_PASS).trim() : '',
    nodeEnv: env.NODE_ENV || 'development',
  };
}

export const envConfig = validateRequiredEnv();
