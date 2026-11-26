import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { ACADEMIC_ROLES, ADMIN_ONLY, STAFF_ROLES, ROLES } from '../config/permissions.js';
import { body, validationResult } from 'express-validator';
import { registrarLog, LogActions, LogModules } from '../utils/logger.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Función auxiliar para determinar categoría de examen
const determinarCategoriaExamen = (nombre) => {
  if (!nombre) return nombre;
  if (nombre.includes('Blanco → Amarillo') || nombre.includes('Blanco') || nombre.includes('White')) return 'Blanco → Amarillo';
  if (nombre.includes('Amarillo → Naranja') || nombre.includes('Amarillo') || nombre.includes('Yellow')) return 'Amarillo → Naranja';
  if (nombre.includes('Naranja → Verde') || nombre.includes('Naranja') || nombre.includes('Orange')) return 'Naranja → Verde';
  if (nombre.includes('Verde → Azul') || nombre.includes('Verde') || nombre.includes('Green')) return 'Verde → Azul';
  if (nombre.includes('Azul → Marrón') || nombre.includes('Azul') || nombre.includes('Blue')) return 'Azul → Marrón';
  if (nombre.includes('Marrón → Negro') || nombre.includes('Marrón') || nombre.includes('Brown')) return 'Marrón → Negro';
  if (nombre.includes('Dan Avanzado') || nombre.includes('Negro') || nombre.includes('Black')) return 'Negro → Dan Avanzado';
  return nombre;
};

function calcularMesesPreparacionPorOrden(ordenCinta = 1) {
  if (ordenCinta <= 2) return 4;
  if (ordenCinta <= 4) return 6;
  if (ordenCinta === 5) return 8;
  if (ordenCinta === 6) return 12;
  return 18;
}

function sumarMesesISO(fechaBaseStr, meses) {
  const base = fechaBaseStr ? new Date(fechaBaseStr) : new Date();
  const segura = Number.isNaN(base.getTime()) ? new Date() : base;
  const resultado = new Date(segura);
  resultado.setMonth(resultado.getMonth() + meses);
  return resultado.toISOString().split('T')[0];
}

// Estadísticas reales de promociones y ascensos (DEBE ir antes de GET /:id)
router.get('/estadisticas/promociones', requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const [{ data: promociones, error: promoError }, { data: cintas }] = await Promise.all([
      supabase
        .from('alumnoevaluacion')
        .select(`
          id,
          id_alumno,
          id_evaluacion,
          aprobado,
          notas,
          cinta_anterior_id,
          cinta_nueva_id,
          fecha_evaluacion,
          alumno:id_alumno(id, nombre, cedula),
          evaluacion:id_evaluacion(id, nombre, fecha)
        `)
        .eq('aprobado', true)
        .order('fecha_evaluacion', { ascending: false }),
      supabase.from('cintas').select('id, nombre, color_hex'),
    ]);

    if (promoError) {
      console.error('Error obteniendo estadísticas de promociones:', promoError);
      return res.status(500).json({ error: 'Error interno del servidor', details: promoError.message });
    }

    const cintasMap = {};
    (cintas || []).forEach((c) => {
      cintasMap[c.id] = c;
    });

    const lista = (promociones || []).map((p) => {
      const alumnoObj = Array.isArray(p.alumno) ? p.alumno[0] : p.alumno;
      const evalObj = Array.isArray(p.evaluacion) ? p.evaluacion[0] : p.evaluacion;
      return {
        id: p.id,
        id_alumno: p.id_alumno,
        alumno_nombre: alumnoObj?.nombre || 'Alumno',
        alumno_cedula: alumnoObj?.cedula || null,
        evaluacion_nombre: evalObj?.nombre || 'Evaluación',
        evaluacion_fecha: evalObj?.fecha || p.fecha_evaluacion,
        cinta_anterior: p.cinta_anterior_id ? cintasMap[p.cinta_anterior_id]?.nombre || null : null,
        cinta_nueva: p.cinta_nueva_id ? cintasMap[p.cinta_nueva_id]?.nombre || null : null,
        notas: p.notas || null,
      };
    });

    res.json({
      totalPromociones: lista.length,
      promocionesRecientes: lista.slice(0, 10),
    });
  } catch (error) {
    console.error('Error en /estadisticas/promociones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todas las evaluaciones
router.get('/', requireRole([...ACADEMIC_ROLES, ROLES.USUARIO]), async (req, res) => {
  try {
    const userRole = req.user?.rol || ROLES.USUARIO;
    const userId = req.user?.id;

    let evaluacionesIds = [];

    if (userRole === ROLES.USUARIO) {
      if (!userId) {
        return res.status(403).json({ error: 'Acceso denegado', code: 'FORBIDDEN_RESOURCE' });
      }
      const { data: alumnos, error: alumnosError } = await supabase
        .from('alumno')
        .select('id')
        .eq('usuario_id', userId)
        .eq('estado', true);

      if (alumnosError) {
        console.error('Error obteniendo alumnos del usuario:', alumnosError);
        return res.status(500).json({ error: 'Error interno del servidor', details: alumnosError.message });
      }

      if (!alumnos || alumnos.length === 0) {
        return res.json([]);
      }

      const alumnosIds = alumnos.map((a) => a.id);

      const { data: evaluacionesRel, error: relError } = await supabase
        .from('alumnoevaluacion')
        .select('id_evaluacion')
        .in('id_alumno', alumnosIds);

      if (relError) {
        console.error('Error obteniendo relaciones de evaluaciones:', relError);
        return res.status(500).json({ error: 'Error interno del servidor', details: relError.message });
      }

      if (!evaluacionesRel || evaluacionesRel.length === 0) {
        return res.json([]);
      }

      evaluacionesIds = [...new Set(evaluacionesRel.map((r) => r.id_evaluacion))];
    }

    let evaluacionesQuery = supabase
      .from('evaluacion')
      .select(`
        *,
        usuario:instructor_id(id, nombre_completo)
      `)
      .order('fecha', { ascending: false });

    if (userRole === ROLES.USUARIO && userId && evaluacionesIds.length > 0) {
      evaluacionesQuery = evaluacionesQuery.in('id', evaluacionesIds);
    } else if (userRole === ROLES.USUARIO && userId && evaluacionesIds.length === 0) {
      return res.json([]);
    }

    const { data: evaluaciones, error: evalError } = await evaluacionesQuery;

    if (evalError) {
      console.error('Error obteniendo evaluaciones:', evalError);
      return res.status(500).json({ error: 'Error interno del servidor', details: evalError.message });
    }

    if (!evaluaciones || evaluaciones.length === 0) {
      return res.json([]);
    }

    const evaluacionesIdsParaNiveles = evaluaciones.map((e) => e.id);
    const { data: alumnosEval, error: alumnosEvalError } = await supabase
      .from('alumnoevaluacion')
      .select(`
        id_evaluacion,
        id_alumno,
        aprobado,
        alumno:id_alumno(
          id_categoria_edad,
          id_cinta,
          categorias_edad:id_categoria_edad(nombre),
          cintas:id_cinta(nombre)
        )
      `)
      .in('id_evaluacion', evaluacionesIdsParaNiveles);

    if (alumnosEvalError) {
      console.error('Error obteniendo alumnos de evaluaciones:', alumnosEvalError);
    }

    const evaluacionesConNiveles = evaluaciones.map((evaluacion) => {
      const alumnos = alumnosEval?.filter((ae) => ae.id_evaluacion === evaluacion.id) || [];
      const niveles = [
        ...new Set(
          alumnos
            .map((ae) => {
              const alumno = Array.isArray(ae.alumno) ? ae.alumno[0] : ae.alumno;
              const categoria = Array.isArray(alumno?.categorias_edad) ? alumno.categorias_edad[0] : alumno?.categorias_edad;
              const cinta = Array.isArray(alumno?.cintas) ? alumno.cintas[0] : alumno?.cintas;
              if (categoria?.nombre && cinta?.nombre) {
                return `${categoria.nombre} - ${cinta.nombre}`;
              }
              return null;
            })
            .filter(Boolean)
        ),
      ];

      const instructorObj = Array.isArray(evaluacion.usuario) ? evaluacion.usuario[0] : evaluacion.usuario;
      const totalInscritos = alumnos.length;
      const totalAprobados = alumnos.filter((ae) => ae.aprobado === true).length;

      return {
        ...evaluacion,
        instructor_nombre: instructorObj?.nombre_completo || null,
        niveles: niveles.join(', ') || null,
        categoria_examen: determinarCategoriaExamen(evaluacion.nombre),
        total_inscritos: totalInscritos,
        total_aprobados: totalAprobados,
      };
    });

    res.json(evaluacionesConNiveles);
  } catch (error) {
    console.error('Error obteniendo evaluaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener una evaluación por ID
router.get('/:id', requireRole([...ACADEMIC_ROLES, ROLES.USUARIO]), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: evaluacion, error: evalError } = await supabase
      .from('evaluacion')
      .select('*')
      .eq('id', id)
      .single();

    if (evalError || !evaluacion) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    if (req.user.rol === ROLES.USUARIO) {
      const { data: misAlumnos } = await supabase
        .from('alumno')
        .select('id')
        .eq('usuario_id', req.user.id);

      const misAlumnosIds = (misAlumnos || []).map((a) => a.id);
      if (misAlumnosIds.length === 0) {
        return res.status(403).json({
          error: 'Acceso denegado a esta evaluación',
          code: 'FORBIDDEN_RESOURCE',
        });
      }

      const { data: inscripcion } = await supabase
        .from('alumnoevaluacion')
        .select('id')
        .eq('id_evaluacion', id)
        .in('id_alumno', misAlumnosIds)
        .limit(1);

      if (!inscripcion || inscripcion.length === 0) {
        return res.status(403).json({
          error: 'Acceso denegado: no estás inscrito en esta evaluación',
          code: 'FORBIDDEN_RESOURCE',
        });
      }
    }

    res.json(evaluacion);
  } catch (error) {
    console.error('Error obteniendo evaluación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva evaluación
router.post(
  '/',
  requireRole(ACADEMIC_ROLES),
  [
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('fecha').notEmpty().withMessage('Fecha es requerida'),
    body('hora').notEmpty().withMessage('Hora es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { nombre, fecha, hora, descripcion, instructor_id, alumnos_ids } = req.body;

      const evaluacionData = {
        nombre,
        fecha,
        hora: hora || null,
        descripcion: descripcion || null,
        instructor_id: instructor_id ? Number(instructor_id) : null,
        estado: 'pendiente',
      };

      const { data: evaluacion, error: evalError } = await supabase
        .from('evaluacion')
        .insert(evaluacionData)
        .select()
        .single();

      if (evalError) {
        console.error('Error creando evaluación:', evalError);
        return res.status(500).json({ error: 'Error creando evaluación', details: evalError.message });
      }

      const evaluacionId = evaluacion.id;

      const extraerCintaOrigen = (nombreExamen) => {
        const mapeo = {
          'Blanco → Amarillo': 'Blanco',
          'White → Yellow': 'Blanco',
          'Amarillo → Naranja': 'Amarillo',
          'Yellow → Orange': 'Amarillo',
          'Naranja → Verde': 'Naranja',
          'Orange → Green': 'Naranja',
          'Verde → Azul': 'Verde',
          'Green → Blue': 'Verde',
          'Azul → Marrón': 'Azul',
          'Blue → Brown': 'Azul',
          'Marrón → Negro': 'Marrón',
          'Brown → Black': 'Marrón',
          'Dan Avanzado': 'Negro',
          'Advanced Dan': 'Negro',
        };

        for (const [patron, cinta] of Object.entries(mapeo)) {
          if (nombreExamen.includes(patron)) {
            return cinta.toLowerCase();
          }
        }
        return null;
      };

      if (alumnos_ids && alumnos_ids.length > 0) {
        const cintaRequerida = extraerCintaOrigen(nombre);
        const alumnosInvalidos = [];

        for (const alumnoId of alumnos_ids) {
          try {
            let cintaActualId = null;
            const { data: alumnoData, error: alumnoError } = await supabase
              .from('alumno')
              .select(`
                nombre,
                id_cinta,
                cintas:id_cinta(nombre)
              `)
              .eq('id', alumnoId)
              .single();

            if (!alumnoError && alumnoData) {
              cintaActualId = alumnoData.id_cinta || null;
              if (cintaRequerida) {
                const cinta = Array.isArray(alumnoData.cintas) ? alumnoData.cintas[0] : alumnoData.cintas;
                const cintaAlumno = cinta?.nombre?.toLowerCase() || '';
                const alumnoNombre = alumnoData.nombre;

                const cintasValidas = {
                  blanco: ['blanco', 'blanca'],
                  amarillo: ['amarillo', 'amarilla'],
                  naranja: ['naranja'],
                  verde: ['verde'],
                  azul: ['azul'],
                  marrón: ['marrón', 'marron'],
                  negro: ['negro', 'negra'],
                };

                const esValida = cintasValidas[cintaRequerida]?.includes(cintaAlumno) || false;

                if (!esValida) {
                  alumnosInvalidos.push(`${alumnoNombre} (tiene cinta ${cinta?.nombre || 'N/A'}, requiere ${cintaRequerida})`);
                  continue;
                }
              }
            }

            const { error: insertError } = await supabase
              .from('alumnoevaluacion')
              .insert({
                id_alumno: alumnoId,
                id_evaluacion: evaluacionId,
                cinta_anterior_id: cintaActualId,
              });

            if (insertError) {
              console.error(`Error agregando alumno ${alumnoId} a evaluación ${evaluacionId}:`, insertError.message);
            }
          } catch (error) {
            console.error(`Error agregando alumno ${alumnoId} a evaluación ${evaluacionId}:`, error.message);
          }
        }

        if (alumnosInvalidos.length > 0) {
          console.warn(`Alumnos no agregados por cinta incorrecta: ${alumnosInvalidos.join(', ')}`);
        }
      }

      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.CREAR,
        modulo: LogModules.EVALUACIONES,
        descripcion: `Evaluación creada: ${nombre} - Fecha: ${fecha}, Hora: ${hora}`,
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent'),
      });

      res.status(201).json({
        id: evaluacionId,
        message: 'Evaluación creada exitosamente',
      });
    } catch (error) {
      console.error('Error creando evaluación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Actualizar evaluación
router.put(
  '/:id',
  requireRole(ACADEMIC_ROLES),
  [
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('fecha').notEmpty().withMessage('Fecha es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { nombre, fecha, hora, descripcion, instructor_id, estado } = req.body;

      const updatePayload = {
        nombre,
        fecha,
        descripcion: descripcion || null,
      };

      if (hora !== undefined) updatePayload.hora = hora || null;
      if (instructor_id !== undefined) updatePayload.instructor_id = instructor_id ? Number(instructor_id) : null;
      if (estado !== undefined) updatePayload.estado = estado;

      const { error: updateError } = await supabase
        .from('evaluacion')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('Error actualizando evaluación:', updateError);
        return res.status(500).json({ error: 'Error actualizando evaluación', details: updateError.message });
      }

      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.ACTUALIZAR,
        modulo: LogModules.EVALUACIONES,
        descripcion: `Evaluación actualizada (ID ${id}): ${nombre} (${estado || 'sin cambio de estado'})`,
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('User-Agent'),
      });

      res.json({ message: 'Evaluación actualizada exitosamente' });
    } catch (error) {
      console.error('Error actualizando evaluación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Calificar evaluación y promover automáticamente de cinta a los aprobados
router.put('/:id/calificar', requireRole(ACADEMIC_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { calificaciones, completar_evaluacion } = req.body;

    if (!Array.isArray(calificaciones) || calificaciones.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos una calificación en el arreglo calificaciones' });
    }

    const { data: evaluacion, error: evalError } = await supabase
      .from('evaluacion')
      .select('id, nombre, fecha, estado')
      .eq('id', id)
      .single();

    if (evalError || !evaluacion) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    const { data: cintasCatalogo, error: cintasError } = await supabase
      .from('cintas')
      .select('id, nombre, orden, color_hex')
      .order('orden', { ascending: true });

    if (cintasError) {
      return res.status(500).json({ error: 'Error cargando catálogo de cintas', details: cintasError.message });
    }

    const cintasOrdenadas = cintasCatalogo || [];
    const cintasPorId = {};
    cintasOrdenadas.forEach((c) => {
      cintasPorId[c.id] = c;
    });

    let promovidos = 0;
    let calificados = 0;

    for (const item of calificaciones) {
      const idAlumno = Number(item.id_alumno);
      if (!idAlumno) continue;

      const aprobadoVal =
        item.aprobado === true || item.aprobado === 'true'
          ? true
          : item.aprobado === false || item.aprobado === 'false'
            ? false
            : null;
      const notasVal = item.notas !== undefined && item.notas !== null && String(item.notas).trim() !== ''
        ? String(item.notas).trim()
        : null;

      const { data: registroActual } = await supabase
        .from('alumnoevaluacion')
        .select('id, aprobado, cinta_anterior_id, cinta_nueva_id')
        .eq('id_evaluacion', id)
        .eq('id_alumno', idAlumno)
        .maybeSingle();

      const { data: alumno } = await supabase
        .from('alumno')
        .select(`
          id,
          nombre,
          id_cinta,
          id_categoria_edad,
          categorias_edad:id_categoria_edad(nombre, cinta_maxima)
        `)
        .eq('id', idAlumno)
        .maybeSingle();

      if (!alumno) continue;

      let cintaAnteriorId = registroActual?.cinta_anterior_id || alumno.id_cinta || null;
      let cintaNuevaId = registroActual?.cinta_nueva_id || null;

      // Si aprueba y todavía no ha sido promovido en esta evaluación, ascender a la siguiente cinta
      if (aprobadoVal === true && !cintaNuevaId) {
        const cintaActualObj = cintaAnteriorId ? cintasPorId[cintaAnteriorId] : null;
        const categoriaObj = Array.isArray(alumno.categorias_edad)
          ? alumno.categorias_edad[0]
          : alumno.categorias_edad;

        let siguienteCinta = null;
        if (cintaActualObj) {
          siguienteCinta = cintasOrdenadas.find((c) => (c.orden || 0) > (cintaActualObj.orden || 0)) || null;

          // Verificar techo de cinta máxima por categoría de edad si aplica
          if (siguienteCinta && categoriaObj?.cinta_maxima) {
            const cintaTecho = cintasOrdenadas.find(
              (c) => c.nombre.toLowerCase() === String(categoriaObj.cinta_maxima).toLowerCase()
            );
            if (cintaTecho && (siguienteCinta.orden || 0) > (cintaTecho.orden || 999)) {
              siguienteCinta = null;
            }
          }
        } else if (cintasOrdenadas.length > 1) {
          siguienteCinta = cintasOrdenadas[1];
        }

        if (siguienteCinta && siguienteCinta.id !== alumno.id_cinta) {
          cintaNuevaId = siguienteCinta.id;
          const mesesPrep = calcularMesesPreparacionPorOrden(siguienteCinta.orden || 2);
          const proximoExamen = sumarMesesISO(evaluacion.fecha, mesesPrep);

          const { error: promoAlumnoErr } = await supabase
            .from('alumno')
            .update({
              id_cinta: cintaNuevaId,
              tiempo_preparacion_meses: mesesPrep,
              proximo_examen_fecha: proximoExamen,
              updated_at: new Date().toISOString(),
            })
            .eq('id', idAlumno);

          if (!promoAlumnoErr) {
            promovidos++;
          }
        }
      }

      const payloadAE = {
        id_alumno: idAlumno,
        id_evaluacion: Number(id),
        aprobado: aprobadoVal,
        notas: notasVal,
        cinta_anterior_id: cintaAnteriorId,
        cinta_nueva_id: aprobadoVal === true ? cintaNuevaId : null,
        fecha_evaluacion: new Date().toISOString(),
      };

      if (registroActual?.id) {
        await supabase.from('alumnoevaluacion').update(payloadAE).eq('id', registroActual.id);
      } else {
        await supabase.from('alumnoevaluacion').insert(payloadAE);
      }

      calificados++;
    }

    let nuevoEstadoEval = evaluacion.estado;
    if (completar_evaluacion === true) {
      nuevoEstadoEval = 'completada';
      await supabase
        .from('evaluacion')
        .update({ estado: 'completada' })
        .eq('id', id);
    }

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.ACTUALIZAR,
      modulo: LogModules.EVALUACIONES,
      descripcion: `Evaluación "${evaluacion.nombre}" calificada: ${calificados} alumno(s) evaluados, ${promovidos} ascenso(s) de cinta`,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      message: 'Calificaciones guardadas correctamente',
      calificados,
      promovidos,
      estado: nuevoEstadoEval,
    });
  } catch (error) {
    console.error('Error calificando evaluación:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Eliminar evaluación
router.delete('/:id', requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: resultadosCalificados, error: countError } = await supabase
      .from('alumnoevaluacion')
      .select('id, aprobado, notas')
      .eq('id_evaluacion', id);

    if (countError) {
      console.error('Error verificando resultados:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const conResultados = (resultadosCalificados || []).filter(
      (r) => r.notas !== null || r.aprobado !== null
    );

    if (conResultados.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar la evaluación porque tiene ${conResultados.length} resultado(s) calificado(s) asociado(s)`,
      });
    }

    await supabase
      .from('alumnoevaluacion')
      .delete()
      .eq('id_evaluacion', id);

    const { error: deleteError } = await supabase
      .from('evaluacion')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando evaluación:', deleteError);
      return res.status(500).json({ error: 'Error eliminando evaluación', details: deleteError.message });
    }

    await registrarLog({
      usuario_id: req.user.id,
      accion: LogActions.ELIMINAR,
      modulo: LogModules.EVALUACIONES,
      descripcion: `Evaluación eliminada - ID: ${id}`,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent'),
    });

    res.json({ message: 'Evaluación eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando evaluación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener resultados e inscritos de una evaluación (sin ocultar inscritos por fecha)
router.get('/:id/resultados', requireRole([...ACADEMIC_ROLES, ROLES.USUARIO]), async (req, res) => {
  try {
    const { id } = req.params;
    let misAlumnosIds = null;

    if (req.user.rol === ROLES.USUARIO) {
      const { data: misAlumnos } = await supabase
        .from('alumno')
        .select('id')
        .eq('usuario_id', req.user.id);

      misAlumnosIds = (misAlumnos || []).map((a) => a.id);
      if (misAlumnosIds.length === 0) {
        return res.status(403).json({
          error: 'Acceso denegado a los resultados de esta evaluación',
          code: 'FORBIDDEN_RESOURCE',
        });
      }
    }

    const [{ data: evaluacion, error: evalError }, { data: cintas }] = await Promise.all([
      supabase.from('evaluacion').select('id, fecha, estado').eq('id', id).single(),
      supabase.from('cintas').select('id, nombre, color_hex, orden'),
    ]);

    if (evalError || !evaluacion) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    const cintasMap = {};
    (cintas || []).forEach((c) => {
      cintasMap[c.id] = c;
    });

    let aeQuery = supabase
      .from('alumnoevaluacion')
      .select(`
        id,
        id_alumno,
        aprobado,
        notas,
        cinta_anterior_id,
        cinta_nueva_id,
        fecha_evaluacion,
        alumno:id_alumno(
          id,
          nombre,
          cedula,
          id_cinta,
          proximo_examen_fecha,
          tiempo_preparacion_meses,
          estado
        )
      `)
      .eq('id_evaluacion', id);

    if (misAlumnosIds) {
      aeQuery = aeQuery.in('id_alumno', misAlumnosIds);
    }

    const { data: alumnoEvaluaciones, error: aeError } = await aeQuery;

    if (aeError) {
      console.error('Error obteniendo resultados:', aeError);
      return res.status(500).json({ error: 'Error interno del servidor', details: aeError.message });
    }

    if (misAlumnosIds && (!alumnoEvaluaciones || alumnoEvaluaciones.length === 0)) {
      return res.status(403).json({
        error: 'Acceso denegado: no estás inscrito en esta evaluación',
        code: 'FORBIDDEN_RESOURCE',
      });
    }

    const resultados = (alumnoEvaluaciones || [])
      .map((ae) => {
        const alumno = Array.isArray(ae.alumno) ? ae.alumno[0] : ae.alumno;
        if (!alumno) return null;

        const cintaActual = alumno.id_cinta ? cintasMap[alumno.id_cinta] : null;
        const cintaAnterior = ae.cinta_anterior_id ? cintasMap[ae.cinta_anterior_id] : cintaActual;
        const cintaNueva = ae.cinta_nueva_id ? cintasMap[ae.cinta_nueva_id] : null;

        return {
          id: ae.id,
          id_alumno: ae.id_alumno,
          aprobado: ae.aprobado,
          notas: ae.notas,
          cinta_anterior_id: ae.cinta_anterior_id,
          cinta_anterior_nombre: cintaAnterior?.nombre || null,
          cinta_nueva_id: ae.cinta_nueva_id,
          cinta_nueva_nombre: cintaNueva?.nombre || null,
          cinta_actual_id: alumno.id_cinta,
          cinta_actual_nombre: cintaActual?.nombre || null,
          alumno_nombre: alumno.nombre,
          alumno_cedula: alumno.cedula,
          proximo_examen_fecha: alumno.proximo_examen_fecha,
          tiempo_preparacion_meses: alumno.tiempo_preparacion_meses,
          fecha_evaluacion: ae.fecha_evaluacion,
        };
      })
      .filter(Boolean);

    res.json(resultados);
  } catch (error) {
    console.error('Error obteniendo resultados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inscribir / agregar resultado individual de evaluación
router.post(
  '/:id/resultados',
  requireRole(ACADEMIC_ROLES),
  [body('id_alumno').notEmpty().withMessage('ID del alumno es requerido')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { id_alumno, aprobado, notas } = req.body;

      const { data: alumno } = await supabase
        .from('alumno')
        .select('id_cinta')
        .eq('id', id_alumno)
        .maybeSingle();

      const { data: resultado, error: insertError } = await supabase
        .from('alumnoevaluacion')
        .upsert(
          {
            id_alumno: Number(id_alumno),
            id_evaluacion: Number(id),
            aprobado: typeof aprobado === 'boolean' ? aprobado : null,
            notas: notas || null,
            cinta_anterior_id: alumno?.id_cinta || null,
          },
          { onConflict: 'id_alumno,id_evaluacion' }
        )
        .select()
        .single();

      if (insertError) {
        console.error('Error creando resultado:', insertError);
        return res.status(500).json({ error: 'Error creando resultado', details: insertError.message });
      }

      res.status(201).json({
        id: resultado.id,
        message: 'Alumno registrado en la evaluación exitosamente',
      });
    } catch (error) {
      console.error('Error creando resultado:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

export default router;
