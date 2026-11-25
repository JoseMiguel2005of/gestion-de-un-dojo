import express from 'express';
import { body, validationResult } from 'express-validator';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { MANAGEMENT_ROLES, ROLES } from '../config/permissions.js';

const router = express.Router();
router.use(authenticateToken);

const DIAS_CANONICOS = {
  lunes: 'Lunes',
  monday: 'Lunes',
  martes: 'Martes',
  tuesday: 'Martes',
  miercoles: 'Miércoles',
  wednesday: 'Miércoles',
  jueves: 'Jueves',
  thursday: 'Jueves',
  viernes: 'Viernes',
  friday: 'Viernes',
  sabado: 'Sábado',
  saturday: 'Sábado',
  domingo: 'Domingo',
  sunday: 'Domingo',
};

const ordenDias = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
};

function normalizarDiaSemana(valor) {
  if (!valor || typeof valor !== 'string') return null;
  const clave = valor
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return DIAS_CANONICOS[clave] || null;
}

function normalizarHora(hora) {
  if (!hora || typeof hora !== 'string') return null;
  const limpia = hora.trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(limpia)) return null;
  return limpia.substring(0, 5);
}

// Obtener horarios (filtrados por categoría del usuario si es usuario normal)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    let horarios = [];

    if (userRole === ROLES.USUARIO) {
      const { data: alumnos, error: alumnosError } = await supabase
        .from('alumno')
        .select('id_categoria_edad')
        .eq('usuario_id', userId)
        .eq('estado', true);

      if (alumnosError) {
        console.error('Error obteniendo alumnos del usuario:', alumnosError);
        return res.status(500).json({ error: 'Error interno del servidor', details: alumnosError.message });
      }

      const categoriasIds = [...new Set((alumnos || []).map((a) => a.id_categoria_edad).filter(Boolean))];

      if (categoriasIds.length > 0) {
        const [{ data: horariosConCategoria, error: error1 }, { data: horariosSinCategoria, error: error2 }] =
          await Promise.all([
            supabase.from('horarios_clases').select('*').in('id_categoria_edad', categoriasIds).eq('activo', true),
            supabase.from('horarios_clases').select('*').is('id_categoria_edad', null).eq('activo', true),
          ]);

        if (error1 || error2) {
          console.error('Error obteniendo horarios:', error1 || error2);
          return res.status(500).json({ error: 'Error interno del servidor', details: (error1 || error2).message });
        }

        const mapaUnico = new Map();
        [...(horariosConCategoria || []), ...(horariosSinCategoria || [])].forEach((h) => {
          mapaUnico.set(h.id, h);
        });
        horarios = Array.from(mapaUnico.values());
      } else {
        const { data: horariosPublicos, error: horariosErr } = await supabase
          .from('horarios_clases')
          .select('*')
          .is('id_categoria_edad', null)
          .eq('activo', true);

        if (horariosErr) {
          console.error('Error obteniendo horarios sin categoría:', horariosErr);
          return res.status(500).json({ error: 'Error interno del servidor', details: horariosErr.message });
        }
        horarios = horariosPublicos || [];
      }
    } else {
      const { data: todosHorarios, error: horariosError } = await supabase
        .from('horarios_clases')
        .select('*');

      if (horariosError) {
        console.error('Error obteniendo horarios:', horariosError);
        return res.status(500).json({ error: 'Error interno del servidor', details: horariosError.message });
      }
      horarios = todosHorarios || [];
    }

    if (horarios.length === 0) {
      return res.json([]);
    }

    const categoriasIds = [...new Set(horarios.map((h) => h.id_categoria_edad).filter(Boolean))];
    const instructoresIds = [...new Set(horarios.map((h) => h.instructor_id).filter(Boolean))];

    const categoriasMap = {};
    const instructoresMap = {};

    if (categoriasIds.length > 0) {
      const { data: categorias } = await supabase
        .from('categorias_edad')
        .select('id, nombre')
        .in('id', categoriasIds);
      (categorias || []).forEach((c) => {
        categoriasMap[c.id] = c.nombre;
      });
    }

    if (instructoresIds.length > 0) {
      const { data: instructores } = await supabase
        .from('usuario')
        .select('id, nombre_completo')
        .in('id', instructoresIds);
      (instructores || []).forEach((i) => {
        instructoresMap[i.id] = i.nombre_completo;
      });
    }

    const horariosFormateados = horarios.map((horario) => {
      const diaCanonico = normalizarDiaSemana(horario.dia_semana) || horario.dia_semana;
      return {
        ...horario,
        dia_semana: diaCanonico,
        categoria_edad_nombre: horario.id_categoria_edad ? categoriasMap[horario.id_categoria_edad] || null : null,
        instructor:
          (horario.instructor_id && instructoresMap[horario.instructor_id]) ||
          horario.instructor ||
          null,
      };
    });

    horariosFormateados.sort((a, b) => {
      const ordenA = ordenDias[a.dia_semana] || 99;
      const ordenB = ordenDias[b.dia_semana] || 99;
      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }
      return (a.hora_inicio || '').localeCompare(b.hora_inicio || '');
    });

    res.json(horariosFormateados);
  } catch (error) {
    console.error('Error obteniendo horarios:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Crear horario
router.post('/', requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      id_categoria_edad,
      capacidad_maxima,
      instructor_id,
      instructor: instructorNombreBody,
      activo,
    } = req.body;

    const diaCanonico = normalizarDiaSemana(dia_semana);
    if (!diaCanonico) {
      return res.status(400).json({ error: 'Día de la semana inválido' });
    }

    const inicioNorm = normalizarHora(hora_inicio);
    const finNorm = normalizarHora(hora_fin);
    if (!inicioNorm || !finNorm) {
      return res.status(400).json({ error: 'Las horas de inicio y fin son requeridas (formato HH:MM)' });
    }
    if (finNorm <= inicioNorm) {
      return res.status(400).json({ error: 'La hora de finalización debe ser posterior a la hora de inicio' });
    }

    let instructorNombre = instructorNombreBody ? String(instructorNombreBody).trim() : null;
    const instructorIdNum = instructor_id ? Number(instructor_id) : null;

    if (instructorIdNum) {
      const { data: instructorData } = await supabase
        .from('usuario')
        .select('nombre_completo')
        .eq('id', instructorIdNum)
        .maybeSingle();

      if (instructorData?.nombre_completo) {
        instructorNombre = instructorData.nombre_completo;
      }
    }

    const { data: newHorario, error: insertError } = await supabase
      .from('horarios_clases')
      .insert({
        dia_semana: diaCanonico,
        hora_inicio: inicioNorm,
        hora_fin: finNorm,
        id_categoria_edad: id_categoria_edad ? Number(id_categoria_edad) : null,
        capacidad_maxima: capacidad_maxima ? Number(capacidad_maxima) : null,
        instructor_id: instructorIdNum,
        instructor: instructorNombre,
        activo: activo !== undefined ? Boolean(activo) : true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creando horario:', insertError);
      return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
    }

    res.status(201).json({ id: newHorario.id, message: 'Horario creado exitosamente' });
  } catch (error) {
    console.error('Error creando horario:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Actualizar horario
router.put('/:id', requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      id_categoria_edad,
      capacidad_maxima,
      instructor_id,
      instructor: instructorNombreBody,
      activo,
    } = req.body;

    const diaCanonico = normalizarDiaSemana(dia_semana);
    if (!diaCanonico) {
      return res.status(400).json({ error: 'Día de la semana inválido' });
    }

    const inicioNorm = normalizarHora(hora_inicio);
    const finNorm = normalizarHora(hora_fin);
    if (!inicioNorm || !finNorm) {
      return res.status(400).json({ error: 'Las horas de inicio y fin son requeridas (formato HH:MM)' });
    }
    if (finNorm <= inicioNorm) {
      return res.status(400).json({ error: 'La hora de finalización debe ser posterior a la hora de inicio' });
    }

    let instructorNombre = instructorNombreBody ? String(instructorNombreBody).trim() : null;
    const instructorIdNum = instructor_id ? Number(instructor_id) : null;

    if (instructorIdNum) {
      const { data: instructorData } = await supabase
        .from('usuario')
        .select('nombre_completo')
        .eq('id', instructorIdNum)
        .maybeSingle();

      if (instructorData?.nombre_completo) {
        instructorNombre = instructorData.nombre_completo;
      }
    }

    const updateData = {
      dia_semana: diaCanonico,
      hora_inicio: inicioNorm,
      hora_fin: finNorm,
      id_categoria_edad: id_categoria_edad ? Number(id_categoria_edad) : null,
      capacidad_maxima: capacidad_maxima ? Number(capacidad_maxima) : null,
      instructor_id: instructorIdNum,
      instructor: instructorNombre,
    };

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const { error: updateError } = await supabase
      .from('horarios_clases')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error actualizando horario:', updateError);
      return res.status(500).json({ error: 'Error interno del servidor', details: updateError.message });
    }

    res.json({ message: 'Horario actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando horario:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Eliminar horario
router.delete('/:id', requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('horarios_clases')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando horario:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    res.json({ message: 'Horario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando horario:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener días festivos
router.get('/festivos', async (req, res) => {
  try {
    const { data: diasFestivos, error } = await supabase
      .from('dias_festivos')
      .select('*')
      .order('fecha', { ascending: true });

    if (error) {
      console.error('Error obteniendo días festivos:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    res.json(diasFestivos || []);
  } catch (error) {
    console.error('Error obteniendo días festivos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Agregar día festivo
router.post(
  '/festivos',
  requireRole(MANAGEMENT_ROLES),
  [
    body('fecha').notEmpty().withMessage('La fecha es requerida'),
    body('descripcion').notEmpty().withMessage('La descripción es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fecha, descripcion } = req.body;

      const { data: existingFestivo, error: checkError } = await supabase
        .from('dias_festivos')
        .select('id')
        .eq('fecha', fecha)
        .limit(1);

      if (checkError) {
        console.error('Error verificando día festivo:', checkError);
        return res.status(500).json({ error: 'Error interno del servidor', details: checkError.message });
      }

      if (existingFestivo && existingFestivo.length > 0) {
        return res.status(400).json({ error: 'Ya existe un día festivo en esa fecha' });
      }

      const { data: newFestivo, error: insertError } = await supabase
        .from('dias_festivos')
        .insert({ fecha, descripcion: descripcion.trim() })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error agregando día festivo:', insertError);
        return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
      }

      res.status(201).json({
        id: newFestivo.id,
        message: 'Día festivo agregado exitosamente',
      });
    } catch (error) {
      console.error('Error agregando día festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Actualizar día festivo
router.put(
  '/festivos/:id',
  requireRole(MANAGEMENT_ROLES),
  [
    body('fecha').notEmpty().withMessage('La fecha es requerida'),
    body('descripcion').notEmpty().withMessage('La descripción es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { fecha, descripcion } = req.body;

      const { data: existingFestivo, error: checkError } = await supabase
        .from('dias_festivos')
        .select('id')
        .eq('id', id)
        .limit(1);

      if (checkError) {
        console.error('Error verificando día festivo:', checkError);
        return res.status(500).json({ error: 'Error interno del servidor', details: checkError.message });
      }

      if (!existingFestivo || existingFestivo.length === 0) {
        return res.status(404).json({ error: 'Día festivo no encontrado' });
      }

      const { data: duplicateFestivo, error: dupError } = await supabase
        .from('dias_festivos')
        .select('id')
        .eq('fecha', fecha)
        .neq('id', id)
        .limit(1);

      if (dupError) {
        console.error('Error verificando duplicado:', dupError);
        return res.status(500).json({ error: 'Error interno del servidor', details: dupError.message });
      }

      if (duplicateFestivo && duplicateFestivo.length > 0) {
        return res.status(400).json({ error: 'Ya existe otro día festivo en esa fecha' });
      }

      const { error: updateError } = await supabase
        .from('dias_festivos')
        .update({ fecha, descripcion: descripcion.trim() })
        .eq('id', id);

      if (updateError) {
        console.error('Error actualizando día festivo:', updateError);
        return res.status(500).json({ error: 'Error interno del servidor', details: updateError.message });
      }

      res.json({
        message: 'Día festivo actualizado exitosamente',
        id,
      });
    } catch (error) {
      console.error('Error actualizando día festivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Eliminar día festivo
router.delete('/festivos/:id', requireRole(MANAGEMENT_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: checkError } = await supabase
      .from('dias_festivos')
      .select('id')
      .eq('id', id)
      .limit(1);

    if (checkError) {
      console.error('Error verificando día festivo:', checkError);
      return res.status(500).json({ error: 'Error interno del servidor', details: checkError.message });
    }

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Día festivo no encontrado' });
    }

    const { error: deleteError } = await supabase
      .from('dias_festivos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando día festivo:', deleteError);
      return res.status(500).json({ error: 'Error interno del servidor', details: deleteError.message });
    }

    res.json({ message: 'Día festivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando día festivo:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

export default router;
