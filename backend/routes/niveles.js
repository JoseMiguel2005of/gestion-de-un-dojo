import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { ACADEMIC_ROLES, ADMIN_ONLY } from '../config/permissions.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

router.use(authenticateToken);

const DEFAULT_CATEGORY_META = {
  'Benjamín': { edad_min: 6, edad_max: 8, cinta_maxima: 'Verde', orden: 1 },
  'Alevín': { edad_min: 9, edad_max: 10, cinta_maxima: 'Azul', orden: 2 },
  'Infantil': { edad_min: 11, edad_max: 12, cinta_maxima: 'Azul', orden: 3 },
  'Cadete': { edad_min: 13, edad_max: 15, cinta_maxima: 'Marrón', orden: 4 },
  'Junior': { edad_min: 16, edad_max: 17, cinta_maxima: 'Negro', orden: 5 },
  'Senior': { edad_min: 18, edad_max: 34, cinta_maxima: 'Negro', orden: 6 },
  'Veterano': { edad_min: 35, edad_max: 99, cinta_maxima: 'Negro', orden: 7 },
};

function canonicalizeCategoryName(rawName = '') {
  const trimmed = String(rawName).trim();
  const map = {
    'benjamin': 'Benjamín',
    'benjamín': 'Benjamín',
    'alevin': 'Alevín',
    'alevín': 'Alevín',
    'infant': 'Infantil',
    'infantil': 'Infantil',
    'cadet': 'Cadete',
    'cadete': 'Cadete',
    'junior': 'Junior',
    'júnior': 'Junior',
    'senior': 'Senior',
    'veteran': 'Veterano',
    'veterano': 'Veterano',
  };
  return map[trimmed.toLowerCase()] || trimmed;
}

// Obtener todas las categorías de edad
router.get('/categorias-edad', async (req, res) => {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias_edad')
      .select('*')
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error obteniendo categorías de edad:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    res.json(categorias || []);
  } catch (error) {
    console.error('Error obteniendo categorías de edad:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener todas las cintas
router.get('/cintas', async (req, res) => {
  try {
    const { data: cintas, error } = await supabase
      .from('cintas')
      .select('*')
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error obteniendo cintas:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    res.json(cintas || []);
  } catch (error) {
    console.error('Error obteniendo cintas:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener todos los niveles (unificado sobre categorias_edad real)
router.get('/', async (req, res) => {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias_edad')
      .select('*')
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error obteniendo categorías:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    const nivelesUnificados = (categorias || []).map((cat) => ({
      ...cat,
      nivel: cat.nombre,
      cinta: cat.cinta_maxima || null,
    }));

    res.json(nivelesUnificados);
  } catch (error) {
    console.error('Error obteniendo niveles:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener una categoría de edad por ID
router.get('/categorias-edad/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: categoria, error: catError } = await supabase
      .from('categorias_edad')
      .select('*')
      .eq('id', id)
      .single();

    if (catError || !categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(categoria);
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener una cinta por ID
router.get('/cintas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: cinta, error: cintaError } = await supabase
      .from('cintas')
      .select('*')
      .eq('id', id)
      .single();

    if (cintaError || !cinta) {
      return res.status(404).json({ error: 'Cinta no encontrada' });
    }

    res.json(cinta);
  } catch (error) {
    console.error('Error obteniendo cinta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener una categoría/nivel por ID (unificado sobre categorias_edad)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: categoria, error: catError } = await supabase
      .from('categorias_edad')
      .select('*')
      .eq('id', id)
      .single();

    if (catError || !categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({
      ...categoria,
      nivel: categoria.nombre,
      cinta: categoria.cinta_maxima || null,
    });
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva categoría de edad
router.post('/categorias-edad', requireRole(ACADEMIC_ROLES), [
  body('nombre').notEmpty().withMessage('Nombre de la categoría es requerido'),
  body('edad_min').isInt({ min: 0 }).withMessage('Edad mínima debe ser un número válido'),
  body('edad_max').isInt({ min: 0 }).withMessage('Edad máxima debe ser un número válido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const nombreCanonico = canonicalizeCategoryName(req.body.nombre);
    const { edad_min, edad_max, precio_mensualidad, cinta_maxima, orden } = req.body;

    if (Number(edad_max) < Number(edad_min)) {
      return res.status(400).json({ error: 'La edad máxima debe ser mayor o igual a la edad mínima' });
    }
    
    const defaults = DEFAULT_CATEGORY_META[nombreCanonico] || {};

    const { data: categoria, error: insertError } = await supabase
      .from('categorias_edad')
      .insert({
        nombre: nombreCanonico,
        edad_min: Number(edad_min),
        edad_max: Number(edad_max),
        precio_mensualidad: precio_mensualidad !== undefined && precio_mensualidad !== null ? Number(precio_mensualidad) : 50,
        cinta_maxima: cinta_maxima || defaults.cinta_maxima || null,
        orden: orden || defaults.orden || 99
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creando categoría de edad:', insertError);
      return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
    }

    res.status(201).json({ 
      id: categoria.id, 
      message: 'Categoría de edad creada exitosamente' 
    });
  } catch (error) {
    console.error('Error creando categoría de edad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva cinta
router.post('/cintas', requireRole(ACADEMIC_ROLES), [
  body('nombre').notEmpty().withMessage('Nombre de la cinta es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, nombre_en, color_hex, orden, es_dan, nivel_dan } = req.body;
    
    const { data: cinta, error: insertError } = await supabase
      .from('cintas')
      .insert({
        nombre: String(nombre).trim(),
        nombre_en: nombre_en ? String(nombre_en).trim() : null,
        color_hex: color_hex || '#FFFFFF',
        orden: orden ? Number(orden) : 99,
        es_dan: Boolean(es_dan),
        nivel_dan: es_dan && nivel_dan ? Number(nivel_dan) : null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creando cinta:', insertError);
      return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
    }

    res.status(201).json({ 
      id: cinta.id, 
      message: 'Cinta creada exitosamente' 
    });
  } catch (error) {
    console.error('Error creando cinta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear categoría por ruta raíz (unificado en categorias_edad)
router.post('/', requireRole(ACADEMIC_ROLES), [
  body('nombre').notEmpty().withMessage('Nombre de la categoría es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const nombreCanonico = canonicalizeCategoryName(req.body.nombre);
    const defaults = DEFAULT_CATEGORY_META[nombreCanonico] || { edad_min: 6, edad_max: 99, cinta_maxima: 'Negro', orden: 99 };
    const edadMin = req.body.edad_min !== undefined ? Number(req.body.edad_min) : defaults.edad_min;
    const edadMax = req.body.edad_max !== undefined ? Number(req.body.edad_max) : defaults.edad_max;
    const cintaMaxima = req.body.cinta_maxima || defaults.cinta_maxima || null;
    const precioMensualidad = req.body.precio_mensualidad !== undefined && req.body.precio_mensualidad !== null
      ? Number(req.body.precio_mensualidad)
      : 50;

    const { data: categoria, error: insertError } = await supabase
      .from('categorias_edad')
      .insert({
        nombre: nombreCanonico,
        edad_min: edadMin,
        edad_max: edadMax,
        cinta_maxima: cintaMaxima,
        precio_mensualidad: precioMensualidad,
        orden: req.body.orden || defaults.orden || 99
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creando categoría:', insertError);
      return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
    }
    
    res.status(201).json({ 
      id: categoria.id, 
      message: 'Categoría creada exitosamente' 
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar categoría de edad
router.put('/categorias-edad/:id', requireRole(ACADEMIC_ROLES), [
  body('nombre').notEmpty().withMessage('Nombre de la categoría es requerido'),
  body('edad_min').isInt({ min: 0 }).withMessage('Edad mínima debe ser un número válido'),
  body('edad_max').isInt({ min: 0 }).withMessage('Edad máxima debe ser un número válido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const nombreCanonico = canonicalizeCategoryName(req.body.nombre);
    const { edad_min, edad_max, precio_mensualidad, cinta_maxima, orden } = req.body;

    if (Number(edad_max) < Number(edad_min)) {
      return res.status(400).json({ error: 'La edad máxima debe ser mayor o igual a la edad mínima' });
    }

    const updatePayload = {
      nombre: nombreCanonico,
      edad_min: Number(edad_min),
      edad_max: Number(edad_max),
      precio_mensualidad: precio_mensualidad !== undefined && precio_mensualidad !== null ? Number(precio_mensualidad) : 50,
    };
    if (cinta_maxima !== undefined) updatePayload.cinta_maxima = cinta_maxima || null;
    if (orden !== undefined) updatePayload.orden = Number(orden) || 99;

    const { error: updateError } = await supabase
      .from('categorias_edad')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('Error actualizando categoría de edad:', updateError);
      return res.status(500).json({ error: 'Error interno del servidor', details: updateError.message });
    }

    res.json({ message: 'Categoría de edad actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando categoría de edad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar cinta
router.put('/cintas/:id', requireRole(ACADEMIC_ROLES), [
  body('nombre').notEmpty().withMessage('Nombre de la cinta es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { nombre, nombre_en, color_hex, orden, es_dan, nivel_dan } = req.body;

    const { error: updateError } = await supabase
      .from('cintas')
      .update({
        nombre: String(nombre).trim(),
        nombre_en: nombre_en ? String(nombre_en).trim() : null,
        color_hex: color_hex || '#FFFFFF',
        orden: orden ? Number(orden) : 99,
        es_dan: Boolean(es_dan),
        nivel_dan: es_dan && nivel_dan ? Number(nivel_dan) : null
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error actualizando cinta:', updateError);
      return res.status(500).json({ error: 'Error interno del servidor', details: updateError.message });
    }

    res.json({ message: 'Cinta actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando cinta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar categoría por ruta raíz (unificado en categorias_edad)
router.put('/:id', requireRole(ACADEMIC_ROLES), [
  body('nombre').optional().notEmpty().withMessage('Nombre de la categoría no puede estar vacío')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { nombre, edad_min, edad_max, cinta_maxima, precio_mensualidad, orden } = req.body;

    const updatePayload = {};
    if (nombre !== undefined) updatePayload.nombre = canonicalizeCategoryName(nombre);
    if (edad_min !== undefined) updatePayload.edad_min = Number(edad_min);
    if (edad_max !== undefined) updatePayload.edad_max = Number(edad_max);
    if (cinta_maxima !== undefined) updatePayload.cinta_maxima = cinta_maxima || null;
    if (precio_mensualidad !== undefined) {
      updatePayload.precio_mensualidad = precio_mensualidad !== null ? Number(precio_mensualidad) : null;
    }
    if (orden !== undefined) updatePayload.orden = Number(orden) || 99;

    const { error: updateError } = await supabase
      .from('categorias_edad')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('Error actualizando categoría:', updateError);
      return res.status(500).json({ error: 'Error interno del servidor', details: updateError.message });
    }

    res.json({ message: 'Categoría actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar categoría de edad
router.delete('/categorias-edad/:id', requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;

    const { count, error: countError } = await supabase
      .from('alumno')
      .select('*', { count: 'exact', head: true })
      .eq('id_categoria_edad', id);

    if (countError) {
      console.error('Error verificando alumnos:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if ((count || 0) > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la categoría porque hay alumnos asignados' 
      });
    }

    const { error: deleteError } = await supabase
      .from('categorias_edad')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando categoría:', deleteError);
      return res.status(500).json({ error: 'Error interno del servidor', details: deleteError.message });
    }

    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar cinta
router.delete('/cintas/:id', requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;

    const { count, error: countError } = await supabase
      .from('alumno')
      .select('*', { count: 'exact', head: true })
      .eq('id_cinta', id);

    if (countError) {
      console.error('Error verificando alumnos:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if ((count || 0) > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la cinta porque hay alumnos asignados' 
      });
    }

    const { error: deleteError } = await supabase
      .from('cintas')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando cinta:', deleteError);
      return res.status(500).json({ error: 'Error interno del servidor', details: deleteError.message });
    }

    res.json({ message: 'Cinta eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando cinta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar categoría por ruta raíz (unificado en categorias_edad)
router.delete('/:id', requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const { id } = req.params;

    const { count, error: countError } = await supabase
      .from('alumno')
      .select('*', { count: 'exact', head: true })
      .eq('id_categoria_edad', id);

    if (countError) {
      console.error('Error verificando alumnos:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if ((count || 0) > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la categoría porque hay alumnos asignados'
      });
    }

    const { error: deleteError } = await supabase
      .from('categorias_edad')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando categoría:', deleteError);
      return res.status(500).json({ error: 'Error interno del servidor', details: deleteError.message });
    }

    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
