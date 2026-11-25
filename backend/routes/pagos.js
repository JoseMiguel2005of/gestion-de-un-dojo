import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES, ADMIN_ONLY, ROLES } from '../config/permissions.js';
import { body, validationResult } from 'express-validator';
import { registrarLog, LogActions, LogModules } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);

function calcularEdadExacta(fechaNacimientoStr) {
  if (!fechaNacimientoStr) return 0;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimientoStr);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export async function calcularPrecioAlumnoInterno(alumno, esPagoAdelantadoFlag = false) {
  let categoria = null;
  if (alumno.id_categoria_edad) {
    const { data: catData } = await supabase
      .from('categorias_edad')
      .select('*')
      .eq('id', alumno.id_categoria_edad)
      .single();
    if (catData) categoria = catData;
  }

  let cinta = null;
  if (alumno.id_cinta) {
    const { data: cintaData } = await supabase
      .from('cintas')
      .select('nombre, color_hex')
      .eq('id', alumno.id_cinta)
      .single();
    if (cintaData) cinta = cintaData;
  }

  const { data: config } = await supabase
    .from('config_pagos')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const { count: totalPagosValidos } = await supabase
    .from('pagos')
    .select('*', { count: 'exact', head: true })
    .eq('id_alumno', alumno.id)
    .neq('estado', 'rechazado');

  const esAlumnoNuevo = (totalPagosValidos || 0) === 0;
  const precioCategoria = Math.round(Number(categoria?.precio_mensualidad ?? 50) * 100) / 100;
  const tienePersonalizado =
    alumno.precio_personalizado !== null &&
    alumno.precio_personalizado !== undefined &&
    Number(alumno.precio_personalizado) >= 0;

  const precioBase = tienePersonalizado
    ? Math.round(Number(alumno.precio_personalizado) * 100) / 100
    : precioCategoria;

  const descuentoAlumno = Math.max(0, Math.min(100, Number(alumno.descuento_porcentaje || 0)));
  const precioTrasDescuentoAlumno = Math.round(precioBase * (1 - descuentoAlumno / 100) * 100) / 100;

  const esAdelantado = esPagoAdelantadoFlag === 'true' || esPagoAdelantadoFlag === true;
  const descuentoPagoAdelantado = esAdelantado
    ? Math.max(0, Math.min(100, Number(config?.descuento_pago_adelantado || 0)))
    : 0;

  const precioMensualFinal =
    descuentoPagoAdelantado > 0
      ? Math.round(precioTrasDescuentoAlumno * (1 - descuentoPagoAdelantado / 100) * 100) / 100
      : precioTrasDescuentoAlumno;

  const costoInscripcion = esAlumnoNuevo ? Number(config?.costo_inscripcion ?? 15) : 0;
  const precioFinal = Math.round((precioMensualFinal + costoInscripcion) * 100) / 100;

  return {
    alumno_id: alumno.id,
    nombre: alumno.nombre,
    edad: calcularEdadExacta(alumno.fecha_nacimiento),
    categoria_nombre: categoria?.nombre || null,
    cinta_alumno: cinta?.nombre || null,
    precio_categoria: precioCategoria,
    precio_personalizado: tienePersonalizado ? Number(alumno.precio_personalizado) : null,
    descuento_porcentaje: descuentoAlumno,
    descuento_pago_adelantado: descuentoPagoAdelantado,
    observaciones_pago: alumno.observaciones_pago || null,
    es_alumno_nuevo: esAlumnoNuevo,
    costo_inscripcion: costoInscripcion,
    precio_base: precioTrasDescuentoAlumno,
    precio_final: precioFinal,
    es_pago_adelantado: esAdelantado,
    moneda: config?.moneda || 'USD$',
    tipo_cambio_usd_bs: Number(config?.tipo_cambio_usd_bs || 220),
  };
}

// Obtener configuración de pagos
router.get('/config', async (req, res) => {
  try {
    const { data: config, error } = await supabase
      .from('config_pagos')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo configuración de pagos:', error);
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }

    res.json(
      config || {
        dia_corte: 5,
        descuento_pago_adelantado: 0,
        costo_inscripcion: 15,
        moneda: 'USD$',
        metodos_pago: JSON.stringify(['Transferencia Bancaria', 'Pago Móvil', 'Efectivo']),
        datos_bancarios: '',
        pais_configuracion: 'venezuela',
        tipo_cambio_usd_bs: 220,
      }
    );
  } catch (error) {
    console.error('Error obteniendo configuración de pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener precio calculado para un alumno específico
router.get('/precio/:alumnoId', async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { esPagoAdelantado } = req.query;

    const { data: alumno, error: alumnoError } = await supabase
      .from('alumno')
      .select('*')
      .eq('id', alumnoId)
      .single();

    if (alumnoError || !alumno || alumno.estado === false) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    if (req.user.rol === ROLES.USUARIO && String(alumno.usuario_id) !== String(req.user.id)) {
      return res.status(403).json({
        error: 'Acceso denegado: no puedes consultar precios de otro alumno',
        code: 'FORBIDDEN_RESOURCE',
      });
    }

    const resultado = await calcularPrecioAlumnoInterno(alumno, esPagoAdelantado);
    res.json(resultado);
  } catch (error) {
    console.error('Error obteniendo precio del alumno:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener todos los precios (resumen administrativo)
router.get('/precios', requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const [{ data: alumnos, error: alumnosError }, { data: categorias, error: categoriasError }] =
      await Promise.all([
        supabase.from('alumno').select('*').eq('estado', true).order('nombre', { ascending: true }),
        supabase.from('categorias_edad').select('*'),
      ]);

    if (alumnosError) throw alumnosError;
    if (categoriasError) throw categoriasError;

    const categoriasMap = {};
    (categorias || []).forEach((cat) => {
      categoriasMap[cat.id] = cat;
    });

    const precios = (alumnos || []).map((alumno) => {
      const edad = calcularEdadExacta(alumno.fecha_nacimiento);
      const categoria = categoriasMap[alumno.id_categoria_edad] || null;
      const base =
        alumno.precio_personalizado !== null && alumno.precio_personalizado !== undefined
          ? Number(alumno.precio_personalizado)
          : Number(categoria?.precio_mensualidad ?? 50);
      const descuento = Math.max(0, Math.min(100, Number(alumno.descuento_porcentaje || 0)));
      const precioFinal = Math.round(base * (1 - descuento / 100) * 100) / 100;

      return {
        alumno_id: alumno.id,
        nombre: alumno.nombre,
        edad,
        categoria_nombre: categoria?.nombre || null,
        precio_categoria: categoria?.precio_mensualidad ?? null,
        precio_personalizado: alumno.precio_personalizado ?? null,
        descuento_porcentaje: descuento,
        precio_final: precioFinal,
        estado: alumno.estado,
      };
    });

    res.json(precios);
  } catch (error) {
    console.error('Error obteniendo precios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar precio personalizado y beca/descuento real de un alumno
router.put(
  '/precio-personalizado/:alumnoId',
  requireRole(ROLES.ADMIN, ROLES.RECEPCIONISTA),
  async (req, res) => {
    try {
      const { alumnoId } = req.params;
      const { precio_personalizado, descuento_porcentaje, observaciones_pago } = req.body;

      const { data: alumno, error: alumnoError } = await supabase
        .from('alumno')
        .select('*')
        .eq('id', alumnoId)
        .single();

      if (alumnoError || !alumno) {
        return res.status(404).json({ error: 'Alumno no encontrado' });
      }

      const parsedPrecio =
        precio_personalizado === null || precio_personalizado === '' || precio_personalizado === undefined
          ? null
          : Math.max(0, Number(precio_personalizado));

      const parsedDescuento =
        descuento_porcentaje !== undefined
          ? Math.max(0, Math.min(100, Number(descuento_porcentaje) || 0))
          : Number(alumno.descuento_porcentaje || 0);

      const { data: updatedAlumno, error: updateError } = await supabase
        .from('alumno')
        .update({
          precio_personalizado: parsedPrecio,
          descuento_porcentaje: parsedDescuento,
          observaciones_pago: observaciones_pago !== undefined ? observaciones_pago || null : alumno.observaciones_pago,
        })
        .eq('id', alumnoId)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.ACTUALIZAR,
        modulo: LogModules.PAGOS,
        descripcion: `Precio personalizado actualizado para ${alumno.nombre} (ID ${alumnoId}): Base=${parsedPrecio ?? 'Categoría'}, Descuento=${parsedDescuento}%`,
        ip_address: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent'),
      });

      const recalc = await calcularPrecioAlumnoInterno(updatedAlumno, false);
      res.json({
        message: 'Precio y descuento del alumno actualizados exitosamente',
        ...recalc,
      });
    } catch (error) {
      console.error('Error actualizando precio personalizado del alumno:', error);
      res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
);

// Actualizar configuración de pagos
router.put('/config', requireRole(ADMIN_ONLY), async (req, res) => {
  try {
    const {
      dia_corte,
      descuento_pago_adelantado,
      costo_inscripcion,
      moneda,
      metodos_pago,
      datos_bancarios,
      idioma_sistema,
      pais_configuracion,
      tipo_cambio_usd_bs,
    } = req.body;

    const updateData = {};
    if (dia_corte !== undefined) updateData.dia_corte = Number(dia_corte);
    if (descuento_pago_adelantado !== undefined)
      updateData.descuento_pago_adelantado = Number(descuento_pago_adelantado);
    if (costo_inscripcion !== undefined) updateData.costo_inscripcion = Number(costo_inscripcion);
    if (moneda !== undefined) updateData.moneda = moneda;
    if (metodos_pago !== undefined)
      updateData.metodos_pago =
        typeof metodos_pago === 'string' ? metodos_pago : JSON.stringify(metodos_pago);
    if (datos_bancarios !== undefined) updateData.datos_bancarios = datos_bancarios;
    if (idioma_sistema !== undefined) updateData.idioma_sistema = idioma_sistema;
    if (pais_configuracion !== undefined) updateData.pais_configuracion = pais_configuracion;
    if (tipo_cambio_usd_bs !== undefined) updateData.tipo_cambio_usd_bs = Number(tipo_cambio_usd_bs);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    const { data: existingConfig } = await supabase
      .from('config_pagos')
      .select('id')
      .eq('id', 1)
      .maybeSingle();

    const result = existingConfig
      ? await supabase.from('config_pagos').update(updateData).eq('id', 1).select().single()
      : await supabase
          .from('config_pagos')
          .insert([{ id: 1, ...updateData }])
          .select()
          .single();

    if (result.error) {
      console.error('Error actualizando configuración de pagos:', result.error);
      return res.status(500).json({ error: 'Error interno del servidor', details: result.error.message });
    }

    res.json({ message: 'Configuración actualizada exitosamente', config: result.data });
  } catch (error) {
    console.error('Error actualizando configuración de pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

function extraerMesAnioDeTexto(mesCorrespondiente, anioFallback) {
  if (!mesCorrespondiente || typeof mesCorrespondiente !== 'string') {
    return { mes: -1, anio: anioFallback };
  }
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const mesesEn = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const lower = mesCorrespondiente.toLowerCase();
  let mesIdx = -1;
  meses.forEach((m, i) => {
    if (lower.includes(m)) mesIdx = i + 1;
  });
  if (mesIdx === -1) {
    mesesEn.forEach((m, i) => {
      if (lower.includes(m)) mesIdx = i + 1;
    });
  }
  const matchAnio = mesCorrespondiente.match(/\d{4}/);
  const anio = matchAnio ? parseInt(matchAnio[0], 10) : anioFallback;
  return { mes: mesIdx, anio };
}

// Registrar pago (con integridad en servidor de estado y monto)
router.post(
  '/',
  [
    body('metodo_pago').notEmpty().withMessage('El método de pago es requerido'),
    body('fecha_pago').notEmpty().withMessage('La fecha de pago es requerida'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        monto,
        metodo_pago,
        fecha_pago,
        mes: bodyMes,
        anio: bodyAnio,
        mes_correspondiente,
        estado,
        referencia,
        banco_origen,
        cedula_titular,
        telefono_cuenta,
        id_alumno,
        comprobante,
        observaciones,
      } = req.body;

      const registrado_por = req.user.id;
      const esUsuarioNormal = req.user.rol === ROLES.USUARIO;
      const esPersonalPagos = req.user.rol === ROLES.ADMIN || req.user.rol === ROLES.RECEPCIONISTA;

      if (!esUsuarioNormal && !esPersonalPagos) {
        return res.status(403).json({
          error: 'Solo administración, recepción o el propio alumno pueden registrar pagos',
          code: 'FORBIDDEN_ROLE',
        });
      }

      let alumnoRecord = null;

      if (esUsuarioNormal) {
        const { data: alumnos, error: alumnosError } = await supabase
          .from('alumno')
          .select('*')
          .eq('usuario_id', req.user.id);

        if (alumnosError || !alumnos || alumnos.length === 0) {
          return res.status(400).json({ error: 'No tienes un alumno inscrito asociado a tu cuenta' });
        }

        if (id_alumno && !alumnos.some((a) => String(a.id) === String(id_alumno))) {
          return res.status(403).json({
            error: 'Acceso denegado: no puedes registrar pagos para otro alumno',
            code: 'FORBIDDEN_RESOURCE',
          });
        }

        alumnoRecord = id_alumno
          ? alumnos.find((a) => String(a.id) === String(id_alumno))
          : alumnos[0];
      } else {
        if (!id_alumno) {
          return res.status(400).json({ error: 'Debe seleccionar el alumno para registrar el pago' });
        }
        const { data: fetchedAlumno, error: fetchError } = await supabase
          .from('alumno')
          .select('*')
          .eq('id', id_alumno)
          .single();

        if (fetchError || !fetchedAlumno) {
          return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        alumnoRecord = fetchedAlumno;
      }

      const alumnoId = alumnoRecord.id;
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1;
      const anioActual = hoy.getFullYear();

      const extraido = extraerMesAnioDeTexto(mes_correspondiente, anioActual);
      let mes = bodyMes ? parseInt(bodyMes, 10) : extraido.mes;
      let anio = bodyAnio ? parseInt(bodyAnio, 10) : extraido.anio;

      if (!mes || mes < 1 || mes > 12) {
        const parsedFecha = new Date(`${fecha_pago}T12:00:00`);
        mes = !isNaN(parsedFecha.getTime()) ? parsedFecha.getMonth() + 1 : mesActual;
        anio = !isNaN(parsedFecha.getTime()) ? parsedFecha.getFullYear() : anioActual;
      }

      const esPagoAdelantado =
        anio > anioActual ||
        (anio === anioActual && mes > mesActual) ||
        Boolean(observaciones && /pago adelantado|advanced payment/i.test(observaciones));

      if (esPagoAdelantado && esUsuarioNormal) {
        const { data: pagoMesActual } = await supabase
          .from('pagos')
          .select('id, estado')
          .eq('id_alumno', alumnoId)
          .eq('mes', mesActual)
          .eq('anio', anioActual)
          .eq('estado', 'confirmado')
          .limit(1);

        if (!pagoMesActual || pagoMesActual.length === 0) {
          return res.status(400).json({
            error: `No se puede registrar un pago adelantado sin tener confirmado el pago del mes actual (${mesActual}/${anioActual}).`,
          });
        }
      }

      // Verificar duplicados del mismo mes/año ignorando pagos rechazados
      const { data: pagoExistente } = await supabase
        .from('pagos')
        .select('id, estado')
        .eq('id_alumno', alumnoId)
        .eq('mes', mes)
        .eq('anio', anio)
        .neq('estado', 'rechazado')
        .limit(1);

      if (pagoExistente && pagoExistente.length > 0) {
        const estadoExistente = pagoExistente[0].estado;
        return res.status(400).json({
          error:
            estadoExistente === 'confirmado'
              ? `Ya existe un pago CONFIRMADO para el período ${mes}/${anio}.`
              : `Ya tienes un pago PENDIENTE de verificación para el período ${mes}/${anio}.`,
        });
      }

      // Calcular precio autoritativo en servidor
      const calculoServidor = await calcularPrecioAlumnoInterno(alumnoRecord, esPagoAdelantado);

      // Integridad estricta: un usuario normal NUNCA define su estado ni altera el monto
      const estadoAutoritativo = esUsuarioNormal
        ? 'pendiente'
        : estado === 'confirmado' || estado === 'pendiente'
        ? estado
        : 'confirmado';

      const montoAutoritativo = esUsuarioNormal
        ? calculoServidor.precio_final
        : monto !== undefined && !isNaN(Number(monto)) && Number(monto) > 0
        ? Math.round(Number(monto) * 100) / 100
        : calculoServidor.precio_final;

      const mesNombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      });

      const pagoData = {
        id_alumno: alumnoId,
        mes,
        anio,
        monto: montoAutoritativo,
        moneda: calculoServidor.moneda,
        tasa_cambio: calculoServidor.tipo_cambio_usd_bs,
        metodo_pago,
        fecha_pago,
        mes_correspondiente: mes_correspondiente || mesNombre,
        estado: estadoAutoritativo,
        referencia: referencia || null,
        banco_origen: banco_origen || null,
        cedula_titular: cedula_titular || null,
        telefono_cuenta: telefono_cuenta || null,
        comprobante: comprobante || null,
        observaciones: observaciones || null,
        registrado_por,
        verificado_por: estadoAutoritativo === 'confirmado' ? req.user.id : null,
        fecha_verificacion: estadoAutoritativo === 'confirmado' ? new Date().toISOString() : null,
      };

      const { data: result, error: insertError } = await supabase
        .from('pagos')
        .insert([pagoData])
        .select()
        .single();

      if (insertError) {
        console.error('Error insertando pago:', insertError);
        return res.status(500).json({ error: 'Error interno del servidor: ' + insertError.message });
      }

      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.CREAR,
        modulo: LogModules.PAGOS,
        descripcion: `Pago registrado (${estadoAutoritativo}) - Alumno: ${alumnoRecord.nombre}, Período: ${mes}/${anio}, Monto: $${montoAutoritativo}`,
        ip_address: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent'),
      });

      res.status(201).json({
        id: result.id,
        estado: estadoAutoritativo,
        monto: montoAutoritativo,
        message:
          estadoAutoritativo === 'confirmado'
            ? 'Pago registrado y confirmado exitosamente.'
            : 'Pago enviado exitosamente. Queda pendiente de verificación por administración.',
      });
    } catch (error) {
      console.error('Error registrando pago:', error);
      res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
  }
);

// Confirmar un pago pendiente (solo admin / recepcionista)
router.patch(
  '/:id/confirmar',
  requireRole(ROLES.ADMIN, ROLES.RECEPCIONISTA),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body || {};

      const { data: pago, error: fetchError } = await supabase
        .from('pagos')
        .select('*, alumno:id_alumno(nombre)')
        .eq('id', id)
        .single();

      if (fetchError || !pago) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      const updateFields = {
        estado: 'confirmado',
        motivo_rechazo: null,
        verificado_por: req.user.id,
        fecha_verificacion: new Date().toISOString(),
      };
      if (observaciones !== undefined) {
        updateFields.observaciones = observaciones;
      }

      const { error: updateError } = await supabase
        .from('pagos')
        .update(updateFields)
        .eq('id', id);

      if (updateError) throw updateError;

      const alumnoObj = Array.isArray(pago.alumno) ? pago.alumno[0] : pago.alumno;
      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.ACTUALIZAR,
        modulo: LogModules.PAGOS,
        descripcion: `Pago #${id} CONFIRMADO - Alumno: ${alumnoObj?.nombre || pago.id_alumno} (${pago.mes}/${pago.anio})`,
        ip_address: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent'),
      });

      res.json({ message: 'Pago confirmado exitosamente' });
    } catch (error) {
      console.error('Error confirmando pago:', error);
      res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
);

// Rechazar un pago pendiente con motivo (solo admin / recepcionista)
router.patch(
  '/:id/rechazar',
  requireRole(ROLES.ADMIN, ROLES.RECEPCIONISTA),
  [body('motivo_rechazo').trim().notEmpty().withMessage('El motivo de rechazo es obligatorio')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { motivo_rechazo } = req.body;

      const { data: pago, error: fetchError } = await supabase
        .from('pagos')
        .select('*, alumno:id_alumno(nombre)')
        .eq('id', id)
        .single();

      if (fetchError || !pago) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      const { error: updateError } = await supabase
        .from('pagos')
        .update({
          estado: 'rechazado',
          motivo_rechazo: motivo_rechazo.trim(),
          verificado_por: req.user.id,
          fecha_verificacion: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      const alumnoObj = Array.isArray(pago.alumno) ? pago.alumno[0] : pago.alumno;
      await registrarLog({
        usuario_id: req.user.id,
        accion: LogActions.ACTUALIZAR,
        modulo: LogModules.PAGOS,
        descripcion: `Pago #${id} RECHAZADO - Alumno: ${alumnoObj?.nombre || pago.id_alumno}. Motivo: ${motivo_rechazo.trim()}`,
        ip_address: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent'),
      });

      res.json({ message: 'Pago rechazado y notificado en el historial del alumno' });
    } catch (error) {
      console.error('Error rechazando pago:', error);
      res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
);

// Obtener pagos de un alumno específico
router.get('/alumno/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: alumno, error: alumnoError } = await supabase
      .from('alumno')
      .select('id, usuario_id')
      .eq('id', id)
      .single();

    if (alumnoError || !alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }

    if (req.user.rol === ROLES.USUARIO && String(alumno.usuario_id) !== String(req.user.id)) {
      return res.status(403).json({
        error: 'Acceso denegado: no puedes consultar los pagos de otro alumno',
        code: 'FORBIDDEN_RESOURCE',
      });
    }

    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('*')
      .eq('id_alumno', id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .order('created_at', { ascending: false });

    if (pagosError) throw pagosError;

    const userIds = [
      ...new Set(
        (pagos || [])
          .flatMap((p) => [p.registrado_por, p.verificado_por])
          .filter(Boolean)
      ),
    ];
    const usuariosMap = {};

    if (userIds.length > 0) {
      const { data: usuarios } = await supabase
        .from('usuario')
        .select('id, nombre_completo')
        .in('id', userIds);

      (usuarios || []).forEach((u) => {
        usuariosMap[u.id] = u.nombre_completo;
      });
    }

    const pagosConUsuario = (pagos || []).map((pago) => ({
      ...pago,
      registrado_por_nombre: usuariosMap[pago.registrado_por] || null,
      verificado_por_nombre: usuariosMap[pago.verificado_por] || null,
    }));

    res.json(pagosConUsuario);
  } catch (error) {
    console.error('Error obteniendo pagos del alumno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los pagos con filtrado en BD ANTES de paginar
router.get('/', async (req, res) => {
  try {
    const { mes, anio, estado, id_alumno, page = 1, limit = 100, paginated } = req.query;
    const userRole = req.user?.rol || ROLES.USUARIO;
    const userId = req.user?.id;

    let allowedAlumnosIds = null;
    if (userRole === ROLES.USUARIO) {
      if (!userId) {
        return res.status(403).json({ error: 'Acceso denegado', code: 'FORBIDDEN_RESOURCE' });
      }
      const { data: misAlumnos, error: misAlumnosError } = await supabase
        .from('alumno')
        .select('id')
        .eq('usuario_id', userId);

      if (misAlumnosError) {
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      allowedAlumnosIds = (misAlumnos || []).map((a) => a.id);
      if (allowedAlumnosIds.length === 0) {
        return res.json(paginated === 'true' ? { items: [], total: 0, page: 1, limit: Number(limit) } : []);
      }
    }

    const parsedLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (parsedPage - 1) * parsedLimit;

    let pagosQuery = supabase
      .from('pagos')
      .select(
        `
        *,
        alumno:id_alumno(id, nombre, cedula, usuario_id),
        usuario:registrado_por(nombre_completo),
        verificador:verificado_por(nombre_completo)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .order('fecha_pago', { ascending: false });

    if (allowedAlumnosIds) {
      pagosQuery = pagosQuery.in('id_alumno', allowedAlumnosIds);
    } else if (id_alumno) {
      pagosQuery = pagosQuery.eq('id_alumno', parseInt(id_alumno, 10));
    }

    if (mes) {
      pagosQuery = pagosQuery.eq('mes', parseInt(mes, 10));
    }
    if (anio) {
      pagosQuery = pagosQuery.eq('anio', parseInt(anio, 10));
    }
    if (estado && estado !== 'todos') {
      pagosQuery = pagosQuery.eq('estado', estado);
    }

    pagosQuery = pagosQuery.range(offset, offset + parsedLimit - 1);

    const { data: pagos, count, error: pagosError } = await pagosQuery;

    if (pagosError) {
      console.error('Error obteniendo pagos:', pagosError);
      return res.status(500).json({ error: 'Error interno del servidor', details: pagosError.message });
    }

    const pagosFormateados = (pagos || []).map((pago) => {
      const alumno = Array.isArray(pago.alumno) ? pago.alumno[0] : pago.alumno;
      const usuario = Array.isArray(pago.usuario) ? pago.usuario[0] : pago.usuario;
      const verificador = Array.isArray(pago.verificador) ? pago.verificador[0] : pago.verificador;

      return {
        ...pago,
        alumno_nombre: alumno?.nombre || null,
        alumno_cedula: alumno?.cedula || null,
        registrado_por_nombre: usuario?.nombre_completo || null,
        verificado_por_nombre: verificador?.nombre_completo || null,
      };
    });

    if (paginated === 'true') {
      return res.json({
        items: pagosFormateados,
        total: count || 0,
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    res.json(pagosFormateados);
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener alumnos activos sin pago confirmado en el mes/año consultado (morosidad)
router.get('/pendientes', requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const mesConsulta = req.query.mes ? parseInt(req.query.mes, 10) : new Date().getMonth() + 1;
    const anioConsulta = req.query.anio ? parseInt(req.query.anio, 10) : new Date().getFullYear();

    const [{ data: alumnos, error: alumnosError }, { data: pagos, error: pagosError }] =
      await Promise.all([
        supabase
          .from('alumno')
          .select('id, nombre, cedula, telefono, email, id_categoria_edad, precio_personalizado, descuento_porcentaje, categorias_edad:id_categoria_edad(nombre, precio_mensualidad)')
          .eq('estado', true)
          .order('nombre', { ascending: true }),
        supabase
          .from('pagos')
          .select('id_alumno, estado')
          .eq('mes', mesConsulta)
          .eq('anio', anioConsulta)
          .neq('estado', 'rechazado'),
      ]);

    if (alumnosError) throw alumnosError;
    if (pagosError) throw pagosError;

    const confirmadosSet = new Set(
      (pagos || []).filter((p) => p.estado === 'confirmado').map((p) => p.id_alumno)
    );
    const enRevisionSet = new Set(
      (pagos || []).filter((p) => p.estado === 'pendiente').map((p) => p.id_alumno)
    );

    const alumnosPendientes = (alumnos || [])
      .filter((alumno) => !confirmadosSet.has(alumno.id))
      .map((alumno) => {
        const cat = Array.isArray(alumno.categorias_edad)
          ? alumno.categorias_edad[0]
          : alumno.categorias_edad;
        const base =
          alumno.precio_personalizado !== null && alumno.precio_personalizado !== undefined
            ? Number(alumno.precio_personalizado)
            : Number(cat?.precio_mensualidad ?? 50);
        const desc = Math.max(0, Math.min(100, Number(alumno.descuento_porcentaje || 0)));
        const montoEstimado = Math.round(base * (1 - desc / 100) * 100) / 100;

        return {
          id: alumno.id,
          nombre: alumno.nombre,
          cedula: alumno.cedula,
          telefono: alumno.telefono || null,
          email: alumno.email || null,
          categoria_nombre: cat?.nombre || null,
          monto_mensual: montoEstimado,
          en_revision: enRevisionSet.has(alumno.id),
        };
      });

    res.json(alumnosPendientes);
  } catch (error) {
    console.error('Error obteniendo alumnos con pagos pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
