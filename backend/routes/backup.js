import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { ADMIN_ONLY } from '../config/permissions.js';
import { registrarLog, LogActions, LogModules } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken, requireRole(ADMIN_ONLY));

// Orden estricto respetando llaves foráneas de PostgreSQL
const TABLAS_DOMINIO_ORDENADAS = [
  { nombre: 'configuracion', onConflict: 'clave', tieneSecuenciaId: true },
  { nombre: 'config_pagos', onConflict: 'id', tieneSecuenciaId: false },
  { nombre: 'categorias_edad', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'cintas', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'representante', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'alumno', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'alumnorepresentante', onConflict: 'id_alumno,id_representante', tieneSecuenciaId: true },
  { nombre: 'horarios_clases', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'dias_festivos', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'evaluacion', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'alumnoevaluacion', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'pagos', onConflict: 'id', tieneSecuenciaId: true },
  { nombre: 'asistencias', onConflict: 'id', tieneSecuenciaId: true },
];

const MAPA_TABLAS_IMPORTABLES = new Map(
  TABLAS_DOMINIO_ORDENADAS.map((t) => [t.nombre, t])
);

function formatearValorSQLPostgres(valor) {
  if (valor === null || valor === undefined) return 'NULL';
  if (typeof valor === 'boolean') return valor ? 'TRUE' : 'FALSE';
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? String(valor) : 'NULL';
  }
  if (valor instanceof Date) {
    return `'${valor.toISOString().replace(/'/g, "''")}'`;
  }
  if (typeof valor === 'object') {
    return `'${JSON.stringify(valor).replace(/'/g, "''")}'`;
  }
  return `'${String(valor).replace(/'/g, "''")}'`;
}

// Exportar respaldo completo en formato JSON (con redacción de hashes de contraseña)
router.get('/export/json', async (req, res) => {
  try {
    const backup = {
      fecha_backup: new Date().toISOString(),
      sistema: 'Sistema de Gestión de Dojo',
      motor_bd: 'PostgreSQL (Supabase)',
      version: '2.0.0',
      datos: {},
    };

    // Exportar metadatos de usuarios sin exponer password_hash
    const { data: usuariosData } = await supabase
      .from('usuario')
      .select('id, username, email, nombre_completo, rol, estado, activo, email_verificado, idioma_preferido, fecha_creacion');
    backup.datos.usuario_referencia = usuariosData || [];

    for (const infoTabla of TABLAS_DOMINIO_ORDENADAS) {
      const { data, error } = await supabase.from(infoTabla.nombre).select('*');
      if (error) {
        console.error(`Error exportando tabla ${infoTabla.nombre}:`, error.message);
        backup.datos[infoTabla.nombre] = [];
      } else {
        backup.datos[infoTabla.nombre] = data || [];
      }
    }

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.EXPORTAR,
      modulo: LogModules.BACKUP,
      descripcion: 'Exportación de respaldo completo en formato JSON',
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=backup_dojo_${Date.now()}.json`);
    res.json(backup);
  } catch (error) {
    console.error('Error exportando JSON:', error);
    res.status(500).json({ error: 'Error exportando datos en JSON' });
  }
});

// Exportar respaldo en formato SQL estándar PostgreSQL (Supabase)
router.get('/export/sql', async (req, res) => {
  try {
    let sqlContent = `-- ============================================================================
-- Respaldo SQL PostgreSQL - Sistema de Gestión de Dojo v2.0.0
-- Generado: ${new Date().toISOString()}
-- Motor destino: PostgreSQL 15+ / Supabase
-- ============================================================================

BEGIN;
SET TIME ZONE 'UTC';

`;

    for (const infoTabla of TABLAS_DOMINIO_ORDENADAS) {
      const { data: filas, error } = await supabase.from(infoTabla.nombre).select('*');
      if (error) {
        sqlContent += `-- Advertencia: no se pudo leer public.${infoTabla.nombre} (${error.message})\n\n`;
        continue;
      }

      if (!filas || filas.length === 0) {
        sqlContent += `-- Tabla public.${infoTabla.nombre}: sin registros\n\n`;
        continue;
      }

      sqlContent += `-- Datos de public.${infoTabla.nombre} (${filas.length} registros)\n`;
      const columnas = Object.keys(filas[0]);
      const columnasSQL = columnas.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');

      for (const fila of filas) {
        const valoresSQL = columnas.map((col) => formatearValorSQLPostgres(fila[col])).join(', ');
        sqlContent += `INSERT INTO public."${infoTabla.nombre}" (${columnasSQL}) VALUES (${valoresSQL}) ON CONFLICT DO NOTHING;\n`;
      }

      if (infoTabla.tieneSecuenciaId && columnas.includes('id')) {
        sqlContent += `SELECT setval(pg_get_serial_sequence('public.${infoTabla.nombre}', 'id'), COALESCE((SELECT MAX(id) FROM public."${infoTabla.nombre}"), 1), true);\n`;
      }
      sqlContent += '\n';
    }

    sqlContent += 'COMMIT;\n';

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.EXPORTAR,
      modulo: LogModules.BACKUP,
      descripcion: 'Exportación de respaldo completo en formato SQL PostgreSQL',
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=backup_dojo_pg_${Date.now()}.sql`);
    res.send(sqlContent);
  } catch (error) {
    console.error('Error exportando SQL:', error);
    res.status(500).json({ error: 'Error exportando respaldo SQL' });
  }
});

// Importar / restaurar datos desde JSON validando lista blanca y orden FK
router.post('/import/json', async (req, res) => {
  try {
    const payloadDatos = req.body?.datos;

    if (!payloadDatos || typeof payloadDatos !== 'object' || Array.isArray(payloadDatos)) {
      return res.status(400).json({
        error: 'Formato de respaldo inválido: se esperaba un objeto JSON con la propiedad "datos"',
      });
    }

    let importados = 0;
    const tablasProcesadas = [];
    const errores = [];

    // Procesar estrictamente en orden de dependencias de llaves foráneas y solo tablas permitidas
    for (const infoTabla of TABLAS_DOMINIO_ORDENADAS) {
      const registros = payloadDatos[infoTabla.nombre];
      if (!Array.isArray(registros) || registros.length === 0) {
        continue;
      }

      if (!MAPA_TABLAS_IMPORTABLES.has(infoTabla.nombre)) {
        continue;
      }

      let importadosTabla = 0;
      const batchSize = 100;

      for (let i = 0; i < registros.length; i += batchSize) {
        const lote = registros.slice(i, i + batchSize).filter((r) => r && typeof r === 'object');
        if (lote.length === 0) continue;

        const { error: upsertErr } = await supabase
          .from(infoTabla.nombre)
          .upsert(lote, { onConflict: infoTabla.onConflict });

        if (upsertErr) {
          console.error(`Error importando lote en ${infoTabla.nombre}:`, upsertErr.message);
          errores.push({ tabla: infoTabla.nombre, error: upsertErr.message });
        } else {
          importados += lote.length;
          importadosTabla += lote.length;
        }
      }

      if (importadosTabla > 0) {
        tablasProcesadas.push({ tabla: infoTabla.nombre, registros: importadosTabla });
      }
    }

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.IMPORTAR,
      modulo: LogModules.BACKUP,
      descripcion: `Importación de respaldo JSON: ${importados} registro(s) en ${tablasProcesadas.length} tabla(s)`,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      message: 'Importación completada exitosamente',
      registros_importados: importados,
      tablas_procesadas: tablasProcesadas,
      errores,
    });
  } catch (error) {
    console.error('Error importando datos JSON:', error);
    res.status(500).json({ error: 'Error importando datos de respaldo' });
  }
});

// Obtener estadísticas reales del sistema PostgreSQL
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: totalAlumnos },
      { count: totalEvaluaciones },
      { count: totalPagos },
      { count: totalAsistencias },
      { count: totalUsuarios },
      { count: totalLogs },
      { data: ultimoBackup },
    ] = await Promise.all([
      supabase.from('alumno').select('*', { count: 'exact', head: true }),
      supabase.from('evaluacion').select('*', { count: 'exact', head: true }),
      supabase.from('pagos').select('*', { count: 'exact', head: true }),
      supabase.from('asistencias').select('*', { count: 'exact', head: true }),
      supabase.from('usuario').select('*', { count: 'exact', head: true }),
      supabase.from('log_actividades').select('*', { count: 'exact', head: true }),
      supabase.from('configuracion').select('valor').eq('clave', 'ultimo_backup').maybeSingle(),
    ]);

    res.json({
      total_alumnos: totalAlumnos || 0,
      total_evaluaciones: totalEvaluaciones || 0,
      total_pagos: totalPagos || 0,
      total_asistencias: totalAsistencias || 0,
      total_usuarios: totalUsuarios || 0,
      total_logs: totalLogs || 0,
      ultimo_backup: ultimoBackup?.valor || 'Nunca',
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de respaldo:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas', details: error.message });
  }
});

// Verificar integridad referencial de catálogos principales
router.get('/verificar-integridad', async (req, res) => {
  try {
    const problemas = [];

    const [{ data: categorias }, { data: cintas }, { data: alumnos }, { data: horarios }] =
      await Promise.all([
        supabase.from('categorias_edad').select('id'),
        supabase.from('cintas').select('id'),
        supabase.from('alumno').select('id, estado, id_categoria_edad, id_cinta'),
        supabase.from('horarios_clases').select('id, id_categoria_edad'),
      ]);

    const categoriaIds = new Set((categorias || []).map((c) => c.id));
    const cintaIds = new Set((cintas || []).map((c) => c.id));

    const alumnosActivos = (alumnos || []).filter((a) => Boolean(a.estado));
    const sinCategoria = alumnosActivos.filter(
      (a) => !a.id_categoria_edad || !categoriaIds.has(a.id_categoria_edad)
    );
    if (sinCategoria.length > 0) {
      problemas.push({
        tipo: 'advertencia',
        mensaje: `${sinCategoria.length} alumno(s) activo(s) sin categoría de edad válida asignada`,
      });
    }

    const sinCinta = alumnosActivos.filter((a) => !a.id_cinta || !cintaIds.has(a.id_cinta));
    if (sinCinta.length > 0) {
      problemas.push({
        tipo: 'advertencia',
        mensaje: `${sinCinta.length} alumno(s) activo(s) sin cinta oficial asignada`,
      });
    }

    const horariosHuérfanos = (horarios || []).filter(
      (h) => h.id_categoria_edad && !categoriaIds.has(h.id_categoria_edad)
    );
    if (horariosHuérfanos.length > 0) {
      problemas.push({
        tipo: 'error',
        mensaje: `${horariosHuérfanos.length} horario(s) apuntan a una categoría de edad inexistente`,
      });
    }

    res.json({
      estado: problemas.length === 0 ? 'correcto' : 'problemas_encontrados',
      total_problemas: problemas.length,
      problemas,
    });
  } catch (error) {
    console.error('Error verificando integridad:', error);
    res.status(500).json({ error: 'Error verificando integridad' });
  }
});

// Registrar fecha del último backup exportado
router.post('/registrar-backup', async (req, res) => {
  try {
    const fechaBackup = new Date().toISOString();

    const { error } = await supabase
      .from('configuracion')
      .upsert(
        {
          clave: 'ultimo_backup',
          valor: fechaBackup,
          descripcion: 'Fecha del último respaldo exportado',
        },
        { onConflict: 'clave' }
      );

    if (error) {
      throw error;
    }

    res.json({ message: 'Backup registrado exitosamente', fecha: fechaBackup });
  } catch (error) {
    console.error('Error registrando backup:', error);
    res.status(500).json({ error: 'Error registrando backup' });
  }
});

export default router;
