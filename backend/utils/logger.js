import supabase from './supabaseClient.js';

/**
 * Registra una actividad en el sistema de logs
 * @param {Object} logData - Datos del log
 * @param {number} logData.usuario_id - ID del usuario que realizó la acción
 * @param {string} logData.accion - Acción realizada (ej: 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'LOGIN', etc.)
 * @param {string} logData.modulo - Módulo del sistema (ej: 'ALUMNOS', 'EVALUACIONES', 'PAGOS', etc.)
 * @param {string} logData.descripcion - Descripción detallada de la acción
 * @param {string} logData.ip_address - Dirección IP del usuario
 * @param {string} logData.user_agent - User agent del navegador
 */
export async function registrarLog({
  usuario_id = null,
  accion,
  modulo,
  descripcion,
  ip_address = null,
  user_agent = null
}) {
  try {
    const { data, error } = await supabase
      .from('log_actividades')
      .insert({
        usuario_id,
        accion,
        modulo,
        descripcion,
        ip_address,
        user_agent
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error registrando log:', error);
      return null;
    }
    
    console.log(`📝 Log registrado: ${accion} en ${modulo} - ${descripcion}`);
    return data?.id || null;
  } catch (error) {
    console.error('Error registrando log:', error);
    // No lanzamos el error para que no afecte la operación principal
    return null;
  }
}

/**
 * Middleware para extraer información del request y registrar logs automáticamente
 */
export function logMiddleware(accion, modulo, descripcion) {
  return async (req, res, next) => {
    try {
      // Registrar el log después de que la operación sea exitosa
      const originalSend = res.send;
      res.send = function(data) {
        // Solo registrar si la respuesta es exitosa (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          registrarLog({
            usuario_id: req.user?.id || null,
            accion,
            modulo,
            descripcion: descripcion || `${accion} en ${modulo}`,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('User-Agent')
          });
        }
        originalSend.call(this, data);
      };
      next();
    } catch (error) {
      console.error('Error en middleware de logging:', error);
      next();
    }
  };
}

/**
 * Funciones helper para acciones comunes
 */
export const LogActions = {
  CREAR: 'CREAR',
  ACTUALIZAR: 'ACTUALIZAR', 
  ELIMINAR: 'ELIMINAR',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CONSULTAR: 'CONSULTAR',
  EXPORTAR: 'EXPORTAR',
  IMPORTAR: 'IMPORTAR',
  CONFIGURAR: 'CONFIGURAR'
};

export const LogModules = {
  ALUMNOS: 'ALUMNOS',
  EVALUACIONES: 'EVALUACIONES',
  ASISTENCIAS: 'ASISTENCIAS',
  PAGOS: 'PAGOS',
  USUARIOS: 'USUARIOS',
  HORARIOS: 'HORARIOS',
  NIVELES: 'NIVELES',
  REPRESENTANTES: 'REPRESENTANTES',
  CONFIGURACION: 'CONFIGURACION',
  BACKUP: 'BACKUP',
  AUTH: 'AUTH',
  SISTEMA: 'SISTEMA'
};
