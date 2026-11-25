import crypto from 'crypto';
import supabase from './supabaseClient.js';
import { sendUnlockCodeEmail } from './emailService.js';

/**
 * Genera un código de desbloqueo de 6 dígitos
 */
const generateUnlockCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Obtiene o crea un registro de bloqueo para un usuario
 */
const getOrCreateLockRecord = async (usuarioId) => {
  let { data: lockRecord, error } = await supabase
    .from('account_lock')
    .select('*')
    .eq('usuario_id', usuarioId)
    .limit(1);

  if (error) {
    console.error('Error obteniendo lock record:', error);
    throw error;
  }

  if (!lockRecord || lockRecord.length === 0) {
    const { error: insertError } = await supabase
      .from('account_lock')
      .insert({
        usuario_id: usuarioId,
        intentos_fallidos: 0,
        bloqueado: false
      });

    if (insertError) {
      console.error('Error creando lock record:', insertError);
      throw insertError;
    }

    const { data: newRecord, error: selectError } = await supabase
      .from('account_lock')
      .select('*')
      .eq('usuario_id', usuarioId)
      .limit(1);

    if (selectError) {
      console.error('Error obteniendo nuevo lock record:', selectError);
      throw selectError;
    }

    lockRecord = newRecord;
  }

  return lockRecord[0];
};

/**
 * Incrementa el contador de intentos fallidos
 * Los intentos se acumulan entre sesiones (no se resetean automáticamente)
 * Solo se resetean cuando el usuario hace login exitoso
 */
export const incrementFailedAttempts = async (usuarioId) => {
  console.log(`🔐 Incrementando intentos fallidos para usuario ID: ${usuarioId}`);
  const lockRecord = await getOrCreateLockRecord(usuarioId);
  
  // Los intentos se acumulan sin importar el tiempo transcurrido
  // Solo se resetean con login exitoso o desbloqueo manual
  const intentosActuales = lockRecord.intentos_fallidos || 0;
  const nuevosIntentos = intentosActuales + 1;
  const MAX_ATTEMPTS = 3;
  
  console.log(`   Intentos actuales: ${nuevosIntentos}/${MAX_ATTEMPTS}`);
  console.log(`   Intentos previos acumulados: ${intentosActuales}`);
  
  // Actualizar intentos fallidos
  const { error: updateError } = await supabase
    .from('account_lock')
    .update({
      intentos_fallidos: nuevosIntentos,
      updated_at: new Date().toISOString()
    })
    .eq('usuario_id', usuarioId);

  if (updateError) {
    console.error('Error actualizando intentos fallidos:', updateError);
    throw updateError;
  }

  // Si alcanza el límite, bloquear la cuenta
  if (nuevosIntentos >= MAX_ATTEMPTS) {
    console.log(`⚠️ Límite de intentos alcanzado. Bloqueando cuenta para usuario ID: ${usuarioId}`);
    await blockAccount(usuarioId);
    return { blocked: true, attempts: nuevosIntentos };
  }

  return { blocked: false, attempts: nuevosIntentos, remaining: MAX_ATTEMPTS - nuevosIntentos };
};

/**
 * Bloquea una cuenta y envía código de desbloqueo
 */
const blockAccount = async (usuarioId) => {
  console.log(`🔒 Iniciando bloqueo de cuenta para usuario ID: ${usuarioId}`);
  
  // PRIMERO: Bloquear la cuenta en la BD (esto es lo más importante)
  // Generar código de desbloqueo (válido por 30 minutos)
  const unlockCode = generateUnlockCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);
  
  console.log(`   Código de desbloqueo generado. Expira en: ${expiresAt.toISOString()}`);

  // Bloquear cuenta y guardar código (CRÍTICO - debe completarse)
  console.log(`   Guardando bloqueo en base de datos...`);
  const { error: blockError } = await supabase
    .from('account_lock')
    .update({
      bloqueado: true,
      bloqueado_desde: new Date().toISOString(),
      codigo_desbloqueo: unlockCode,
      codigo_expires_at: expiresAt.toISOString(),
      codigo_used: false,
      updated_at: new Date().toISOString()
    })
    .eq('usuario_id', usuarioId)
    .select('id');

  if (blockError) {
    console.error('❌ ERROR CRÍTICO bloqueando cuenta:', blockError.message);
    // Lanzar error solo si falla el bloqueo en BD - esto es crítico
    throw new Error(`Error bloqueando cuenta en BD: ${blockError.message}`);
  }
  
  console.log(`✅ Cuenta bloqueada y código guardado en BD`);

  // SEGUNDO: Intentar obtener email y enviar correo (no crítico)
  let userEmail = null;
  let userName = null;
  
  try {
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('email, username')
      .eq('id', usuarioId)
      .limit(1);

    if (!userError && users && users.length > 0) {
      userEmail = users[0].email;
      userName = users[0].username;
      console.log(`   Email obtenido: ${userEmail}`);
    } else {
      console.warn(`⚠️ No se pudo obtener email del usuario ${usuarioId} para envío de correo`);
      if (userError) {
        console.error('   Error obteniendo usuario:', userError);
      }
    }
  } catch (userFetchError) {
    console.warn(`⚠️ Error al obtener datos del usuario para correo:`, userFetchError.message);
    // No lanzar error - la cuenta ya está bloqueada
  }

  // Enviar código por correo (no crítico - la cuenta ya está bloqueada)
  if (userEmail) {
    try {
      console.log(`📧 Intentando enviar código de desbloqueo a: ${userEmail}`);
      await sendUnlockCodeEmail(userEmail, unlockCode, userName || 'Usuario');
      console.log(`✅ Código de desbloqueo enviado exitosamente a: ${userEmail}`);
    } catch (emailError) {
      // NO lanzar error aquí - la cuenta ya está bloqueada, que es lo importante
      console.error('⚠️ ADVERTENCIA: No se pudo enviar el correo de desbloqueo:');
      console.error('   Error:', emailError.message);
      console.error('   NOTA: La cuenta está bloqueada. El usuario puede solicitar reenvío del código.');
    }
  } else {
    console.warn(`⚠️ No se envió correo porque no se pudo obtener el email del usuario`);
    console.warn(`   La cuenta está bloqueada. El usuario puede solicitar reenvío del código.`);
  }
};

/**
 * Resetea los intentos fallidos (después de login exitoso)
 */
export const resetFailedAttempts = async (usuarioId) => {
  const { error } = await supabase
    .from('account_lock')
    .update({
      intentos_fallidos: 0,
      bloqueado: false,
      bloqueado_desde: null,
      updated_at: new Date().toISOString()
    })
    .eq('usuario_id', usuarioId);

  if (error) {
    console.error('Error reseteando intentos fallidos:', error);
    // No lanzar error aquí, solo loguear, porque esto no debería bloquear el login
  }
};

/**
 * Desbloquea una cuenta manualmente (para administradores)
 */
export const unlockAccount = async (usuarioId) => {
  console.log(`🔓 Desbloqueando cuenta manualmente para usuario ID: ${usuarioId}`);
  
  const { error, data } = await supabase
    .from('account_lock')
    .update({
      bloqueado: false,
      bloqueado_desde: null,
      intentos_fallidos: 0,
      codigo_desbloqueo: null,
      codigo_expires_at: null,
      codigo_used: false,
      updated_at: new Date().toISOString()
    })
    .eq('usuario_id', usuarioId)
    .select();

  if (error) {
    console.error('Error desbloqueando cuenta:', error);
    throw error;
  }

  // Si no existe registro, crear uno limpio
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase
      .from('account_lock')
      .insert({
        usuario_id: usuarioId,
        intentos_fallidos: 0,
        bloqueado: false
      });

    if (insertError) {
      console.error('Error creando registro de bloqueo:', insertError);
      throw insertError;
    }
  }

  console.log(`✅ Cuenta desbloqueada exitosamente para usuario ID: ${usuarioId}`);
  return { success: true };
};

/**
 * Verifica si una cuenta está bloqueada
 */
export const isAccountLocked = async (usuarioId) => {
  console.log(`🔍 Verificando estado de bloqueo para usuario ID: ${usuarioId}`);
  const { data: lockRecord, error } = await supabase
    .from('account_lock')
    .select('bloqueado, bloqueado_desde, intentos_fallidos')
    .eq('usuario_id', usuarioId)
    .limit(1);

  if (error) {
    console.error('❌ Error verificando bloqueo:', error);
    return { locked: false };
  }

  if (!lockRecord || lockRecord.length === 0) {
    console.log(`   No hay registro de bloqueo para usuario ${usuarioId} - cuenta no bloqueada`);
    return { locked: false };
  }

  const isLocked = lockRecord[0].bloqueado === true;
  console.log(`   Estado de bloqueo: ${isLocked ? 'BLOQUEADA' : 'NO BLOQUEADA'}`);
  console.log(`   Intentos fallidos: ${lockRecord[0].intentos_fallidos || 0}`);
  if (isLocked) {
    console.log(`   Bloqueada desde: ${lockRecord[0].bloqueado_desde}`);
  }

  return {
    locked: isLocked,
    lockedSince: lockRecord[0].bloqueado_desde
  };
};

/**
 * Verifica y usa un código de desbloqueo
 */
export const verifyUnlockCode = async (usuarioId, code) => {
  const { data: lockRecord, error } = await supabase
    .from('account_lock')
    .select('codigo_desbloqueo, codigo_expires_at, codigo_used')
    .eq('usuario_id', usuarioId)
    .eq('bloqueado', true)
    .limit(1);

  if (error) {
    console.error('Error verificando código:', error);
    return { valid: false, error: 'Error verificando código' };
  }

  if (!lockRecord || lockRecord.length === 0) {
    return { valid: false, error: 'La cuenta no está bloqueada' };
  }

  const record = lockRecord[0];

  // Verificar si el código ya fue usado
  if (record.codigo_used === true) {
    return { valid: false, error: 'Este código ya fue usado' };
  }

  // Verificar si el código expiró
  const expiresAt = new Date(record.codigo_expires_at);
  if (expiresAt < new Date()) {
    return { valid: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  }

  // Verificar si el código coincide
  if (record.codigo_desbloqueo !== code) {
    return { valid: false, error: 'Código incorrecto' };
  }

  // Código válido - desbloquear cuenta
  const { error: updateError } = await supabase
    .from('account_lock')
    .update({
      bloqueado: false,
      bloqueado_desde: null,
      intentos_fallidos: 0,
      codigo_used: true,
      updated_at: new Date().toISOString()
    })
    .eq('usuario_id', usuarioId);

  if (updateError) {
    console.error('Error desbloqueando cuenta:', updateError);
    return { valid: false, error: 'Error desbloqueando cuenta' };
  }

  return { valid: true };
};

/**
 * Reenvía el código de desbloqueo
 */
export const resendUnlockCode = async (usuarioId) => {
  try {
    const { data: lockRecord, error } = await supabase
      .from('account_lock')
      .select('bloqueado')
      .eq('usuario_id', usuarioId)
      .limit(1);

    if (error) {
      console.error('Error verificando bloqueo para reenvío:', error);
      return { success: false, error: 'Error verificando estado de cuenta' };
    }

    if (!lockRecord || lockRecord.length === 0 || lockRecord[0].bloqueado !== true) {
      return { success: false, error: 'La cuenta no está bloqueada' };
    }

    // Regenerar y enviar código
    await blockAccount(usuarioId);
    return { success: true };
  } catch (error) {
    console.error('Error en resendUnlockCode:', error);
    return { success: false, error: error.message || 'Error reenviando código de desbloqueo' };
  }
};

