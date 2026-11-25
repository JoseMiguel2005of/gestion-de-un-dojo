import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES, ROLES } from '../config/permissions.js';
import { registrarLog, LogActions, LogModules } from '../utils/logger.js';

const router = express.Router();
router.use(authenticateToken);

const ESTADOS_VALIDOS = new Set(['presente', 'ausente', 'tardanza', 'justificado']);

// Obtener sesión de pase de lista (alumnos elegibles + estado guardado para fecha y horario)
router.get('/sesion', requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const { fecha, id_horario } = req.query;

    if (!fecha || !id_horario) {
      return res.status(400).json({ error: 'Los parámetros fecha e id_horario son requeridos' });
    }

    const horarioIdNum = Number(id_horario);
    if (!Number.isFinite(horarioIdNum)) {
      return res.status(400).json({ error: 'id_horario inválido' });
    }

    const [{ data: horario, error: horarioErr }, { data: festivo }] = await Promise.all([
      supabase
        .from('horarios_clases')
        .select('*, categorias_edad:id_categoria_edad(id, nombre)')
        .eq('id', horarioIdNum)
        .single(),
      supabase
        .from('dias_festivos')
        .select('id, fecha, descripcion')
        .eq('fecha', String(fecha))
        .maybeSingle(),
    ]);

    if (horarioErr || !horario) {
      return res.status(404).json({ error: 'Horario de clase no encontrado' });
    }

    let alumnosQuery = supabase
      .from('alumno')
      .select(`
        id,
        nombre,
        cedula,
        id_categoria_edad,
        id_cinta,
        categorias_edad:id_categoria_edad(nombre),
        cintas:id_cinta(nombre, color_hex)
      `)
      .eq('estado', true)
      .order('nombre', { ascending: true });

    if (horario.id_categoria_edad) {
      alumnosQuery = alumnosQuery.eq('id_categoria_edad', horario.id_categoria_edad);
    }

    const [{ data: alumnos, error: alumnosErr }, { data: asistenciasGuardadas, error: asistErr }] =
      await Promise.all([
        alumnosQuery,
        supabase
          .from('asistencias')
          .select('id, id_alumno, estado, observaciones, updated_at')
          .eq('id_horario', horarioIdNum)
          .eq('fecha', String(fecha)),
      ]);

    if (alumnosErr || asistErr) {
      console.error('Error cargando sesión de asistencia:', alumnosErr || asistErr);
      return res.status(500).json({
        error: 'Error cargando sesión de asistencia',
        details: (alumnosErr || asistErr)?.message,
      });
    }

    const asistenciasMap = new Map();
    (asistenciasGuardadas || []).forEach((a) => {
      asistenciasMap.set(a.id_alumno, a);
    });

    const listaAlumnos = (alumnos || []).map((a) => {
      const catObj = Array.isArray(a.categorias_edad) ? a.categorias_edad[0] : a.categorias_edad;
      const cintaObj = Array.isArray(a.cintas) ? a.cintas[0] : a.cintas;
      const reg = asistenciasMap.get(a.id);

      return {
        id_alumno: a.id,
        nombre: a.nombre,
        cedula: a.cedula,
        categoria_nombre: catObj?.nombre || null,
        cinta_nombre: cintaObj?.nombre || null,
        cinta_color: cintaObj?.color_hex || null,
        estado: reg?.estado || null,
        observaciones: reg?.observaciones || '',
        registrado: Boolean(reg),
      };
    });

    res.json({
      fecha: String(fecha),
      es_dia_festivo: Boolean(festivo),
      festivo_descripcion: festivo?.descripcion || null,
      horario: {
        id: horario.id,
        dia_semana: horario.dia_semana,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        instructor: horario.instructor,
        categoria_nombre:
          (Array.isArray(horario.categorias_edad)
            ? horario.categorias_edad[0]?.nombre
            : horario.categorias_edad?.nombre) || null,
      },
      alumnos: listaAlumnos,
    });
  } catch (error) {
    console.error('Error en GET /asistencias/sesion:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registrar o actualizar asistencia en lote para una clase y fecha
router.post('/registrar-lote', requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const { fecha, id_horario, registros } = req.body;

    if (!fecha || !id_horario || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({
        error: 'Se requieren fecha, id_horario y al menos un registro de asistencia',
      });
    }

    const horarioIdNum = Number(id_horario);
    if (!Number.isFinite(horarioIdNum)) {
      return res.status(400).json({ error: 'id_horario inválido' });
    }

    const filasValidas = [];
    for (const item of registros) {
      const idAlumno = Number(item.id_alumno);
      const estado = String(item.estado || '').trim().toLowerCase();
      if (!idAlumno || !ESTADOS_VALIDOS.has(estado)) {
        continue;
      }
      filasValidas.push({
        id_alumno: idAlumno,
        id_horario: horarioIdNum,
        fecha: String(fecha),
        estado,
        observaciones: item.observaciones ? String(item.observaciones).trim() : null,
        registrado_por: req.user.id,
        updated_at: new Date().toISOString(),
      });
    }

    if (filasValidas.length === 0) {
      return res.status(400).json({
        error: 'Ningún registro tiene un estado válido (presente, ausente, tardanza, justificado)',
      });
    }

    const { error: upsertErr } = await supabase
      .from('asistencias')
      .upsert(filasValidas, { onConflict: 'id_alumno,id_horario,fecha' });

    if (upsertErr) {
      console.error('Error guardando lote de asistencias:', upsertErr);
      return res.status(500).json({
        error: 'Error guardando asistencia',
        details: upsertErr.message,
      });
    }

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.ACTUALIZAR,
      modulo: LogModules.ASISTENCIAS,
      descripcion: `Asistencia registrada (${filasValidas.length} alumnos) - Fecha: ${fecha}, Horario ID: ${horarioIdNum}`,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      message: 'Asistencia guardada exitosamente',
      total_guardados: filasValidas.length,
    });
  } catch (error) {
    console.error('Error en POST /asistencias/registrar-lote:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener resumen e historial de asistencia (Staff ve global/filtrado; Usuario solo su propia asistencia)
router.get('/resumen', requireRole([...STAFF_ROLES, ROLES.USUARIO]), async (req, res) => {
  try {
    const { id_alumno, mes, anio } = req.query;
    const esUsuario = req.user.rol === ROLES.USUARIO;

    let alumnosPermitidosIds = null;

    if (esUsuario) {
      const { data: misAlumnos, error: misErr } = await supabase
        .from('alumno')
        .select('id, nombre, cedula')
        .eq('usuario_id', req.user.id)
        .eq('estado', true);

      if (misErr) {
        return res.status(500).json({ error: 'Error consultando perfil de alumno' });
      }

      alumnosPermitidosIds = (misAlumnos || []).map((a) => a.id);
      if (alumnosPermitidosIds.length === 0) {
        return res.json({
          estadisticas: {
            total: 0,
            presentes: 0,
            tardanzas: 0,
            justificados: 0,
            ausentes: 0,
            porcentajeAsistencia: 0,
          },
          porAlumno: [],
          historialReciente: [],
        });
      }

      if (id_alumno && !alumnosPermitidosIds.includes(Number(id_alumno))) {
        return res.status(403).json({
          error: 'Acceso denegado a la asistencia de otro alumno',
          code: 'FORBIDDEN_RESOURCE',
        });
      }
    }

    let query = supabase
      .from('asistencias')
      .select(`
        id,
        id_alumno,
        id_horario,
        fecha,
        estado,
        observaciones,
        alumno:id_alumno(id, nombre, cedula),
        horarios_clases:id_horario(id, dia_semana, hora_inicio, hora_fin, instructor)
      `)
      .order('fecha', { ascending: false })
      .limit(500);

    if (id_alumno) {
      query = query.eq('id_alumno', Number(id_alumno));
    } else if (alumnosPermitidosIds) {
      query = query.in('id_alumno', alumnosPermitidosIds);
    }

    if (anio && mes) {
      const anioNum = Number(anio);
      const mesNum = Number(mes);
      if (Number.isFinite(anioNum) && mesNum >= 1 && mesNum <= 12) {
        const inicioMes = `${anioNum}-${String(mesNum).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anioNum, mesNum, 0).getDate();
        const finMes = `${anioNum}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        query = query.gte('fecha', inicioMes).lte('fecha', finMes);
      }
    } else if (anio) {
      const anioNum = Number(anio);
      if (Number.isFinite(anioNum)) {
        query = query.gte('fecha', `${anioNum}-01-01`).lte('fecha', `${anioNum}-12-31`);
      }
    }

    const { data: registros, error } = await query;

    if (error) {
      console.error('Error consultando resumen de asistencias:', error);
      return res.status(500).json({ error: 'Error consultando asistencias', details: error.message });
    }

    const filas = registros || [];
    let presentes = 0;
    let tardanzas = 0;
    let justificados = 0;
    let ausentes = 0;

    const agrupadoPorAlumno = new Map();

    filas.forEach((r) => {
      if (r.estado === 'presente') presentes++;
      else if (r.estado === 'tardanza') tardanzas++;
      else if (r.estado === 'justificado') justificados++;
      else if (r.estado === 'ausente') ausentes++;

      const alumnoObj = Array.isArray(r.alumno) ? r.alumno[0] : r.alumno;
      if (!agrupadoPorAlumno.has(r.id_alumno)) {
        agrupadoPorAlumno.set(r.id_alumno, {
          id_alumno: r.id_alumno,
          nombre: alumnoObj?.nombre || 'Alumno',
          cedula: alumnoObj?.cedula || null,
          total: 0,
          presentes: 0,
          tardanzas: 0,
          justificados: 0,
          ausentes: 0,
          porcentajeAsistencia: 0,
        });
      }

      const item = agrupadoPorAlumno.get(r.id_alumno);
      item.total++;
      if (r.estado === 'presente') item.presentes++;
      else if (r.estado === 'tardanza') item.tardanzas++;
      else if (r.estado === 'justificado') item.justificados++;
      else if (r.estado === 'ausente') item.ausentes++;
    });

    const porAlumno = Array.from(agrupadoPorAlumno.values()).map((item) => {
      const asistioEfectivo = item.presentes + item.tardanzas + item.justificados;
      return {
        ...item,
        porcentajeAsistencia: item.total > 0 ? Math.round((asistioEfectivo / item.total) * 100) : 0,
      };
    });

    porAlumno.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const total = filas.length;
    const asistioGlobal = presentes + tardanzas + justificados;
    const porcentajeAsistencia = total > 0 ? Math.round((asistioGlobal / total) * 100) : 0;

    const historialReciente = filas.slice(0, 60).map((r) => {
      const alumnoObj = Array.isArray(r.alumno) ? r.alumno[0] : r.alumno;
      const horarioObj = Array.isArray(r.horarios_clases) ? r.horarios_clases[0] : r.horarios_clases;
      return {
        id: r.id,
        id_alumno: r.id_alumno,
        alumno_nombre: alumnoObj?.nombre || 'Alumno',
        alumno_cedula: alumnoObj?.cedula || null,
        fecha: r.fecha,
        estado: r.estado,
        observaciones: r.observaciones || null,
        dia_semana: horarioObj?.dia_semana || null,
        hora_inicio: horarioObj?.hora_inicio || null,
        hora_fin: horarioObj?.hora_fin || null,
        instructor: horarioObj?.instructor || null,
      };
    });

    res.json({
      estadisticas: {
        total,
        presentes,
        tardanzas,
        justificados,
        ausentes,
        porcentajeAsistencia,
      },
      porAlumno,
      historialReciente,
    });
  } catch (error) {
    console.error('Error en GET /asistencias/resumen:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
