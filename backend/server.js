import { envConfig } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import supabase from './utils/supabaseClient.js';
import { verifyEmailConfig } from './utils/emailService.js';

// Importar rutas
import authRoutes from './routes/auth.js';
import alumnosRoutes from './routes/alumnos.js';
import nivelesRoutes from './routes/niveles.js';
import representantesRoutes from './routes/representantes.js';
import evaluacionesRoutes from './routes/evaluaciones.js';
import configuracionRoutes from './routes/configuracion.js';
import usuariosRoutes from './routes/usuarios.js';
import pagosRoutes from './routes/pagos.js';
import horariosRoutes from './routes/horarios.js';
import backupRoutes from './routes/backup.js';

const app = express();
const PORT = envConfig.port;

// Confiar en primer proxy (Vercel / balanceadores) para IPs reales en rate-limit
app.set('trust proxy', 1);

// Cabeceras de seguridad HTTP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware CORS - Permitir tanto el dominio principal como previews de Vercel
const allowedOrigins = [
  envConfig.frontendUrl,
  envConfig.corsOrigin,
  'http://localhost:5173',
  'http://localhost:8080',
  'https://gestion-de-un-dojo-3.vercel.app',
  /^https:\/\/gestion-de-un-dojo-3-.*\.vercel\.app$/, // Previews de Vercel
  /^https:\/\/.*-jose-miguel-rodriguezs-projects\.vercel\.app$/ // Previews autorizados
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/niveles', nivelesRoutes);
app.use('/api/representantes', representantesRoutes);
app.use('/api/evaluaciones', evaluacionesRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/backup', backupRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'API del Dojo funcionando correctamente'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origen no permitido por CORS' });
  }
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    ...(envConfig.nodeEnv === 'development' ? { message: err.message } : {})
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Función para inicializar el servidor (solo para desarrollo local)
const startServer = async () => {
  try {
    // Probar conexión a Supabase
    const { error } = await supabase.from('usuario').select('id').limit(1);
    if (error) {
      console.error('❌ No se pudo conectar a Supabase. Verifica las credenciales.');
      process.exit(1);
    }
    console.log('✅ Conexión a Supabase exitosa.');

    // Verificar configuración de correo
    console.log('\n📧 Verificando servicio de correo...');
    const emailConfigured = await verifyEmailConfig();
    if (!emailConfigured) {
      console.warn('⚠️ ADVERTENCIA: El servicio de correo no está configurado correctamente.');
      console.warn('   La recuperación de contraseña podría no funcionar.');
      console.warn('   Revisa los logs anteriores para más detalles.\n');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
      console.log(`📊 API disponible en http://localhost:${PORT}/api`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Solo iniciar el servidor si no estamos en Vercel (serverless)
// En Vercel, exportamos la app directamente
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  startServer();
}

// Exportar la app para Vercel
export default app;