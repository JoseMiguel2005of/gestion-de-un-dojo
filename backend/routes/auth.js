import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import supabase from '../utils/supabaseClient.js';
import { envConfig } from '../config/env.js';
import { generateToken } from '../middleware/auth.js';
import {
  authGeneralLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  otpVerificationLimiter,
} from '../middleware/rateLimiters.js';
import { registrarLog, LogActions, LogModules } from '../utils/logger.js';
import { body, validationResult } from 'express-validator';
import { sendPasswordResetEmail, sendEmailVerificationCode } from '../utils/emailService.js';
import { verifyEmailFormat, verifyEmailExists } from '../utils/emailVerification.js';
import { 
  incrementFailedAttempts, 
  resetFailedAttempts, 
  isAccountLocked, 
  verifyUnlockCode 
} from '../utils/unlockCodeService.js';

const router = express.Router();

router.use(authGeneralLimiter);

router.post('/login', loginLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido'),
  body('password').notEmpty().withMessage('Password es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, unlockCode } = req.body;

    console.log('🔍 Intento de login con email:', email);

    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username, email, password_hash, nombre_completo, rol, estado, idioma_preferido, email_verificado')
      .eq('email', email)
      .limit(1); // No filtrar por estado aquí, lo verificamos después

    if (userError) {
      console.error('Error consultando usuario:', userError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userError.message });
    }

    if (!users || users.length === 0) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];
    console.log('✅ Usuario encontrado:', user.username, '| Rol:', user.rol, '| ID:', user.id);

    // Verificar si el email está verificado
    if (!user.email_verificado) {
      console.log('⚠️ Email no verificado para usuario:', user.username);
      return res.status(403).json({ 
        error: 'Email no verificado',
        requiresVerification: true,
        message: 'Por favor, verifica tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada para el código de verificación.' 
      });
    }

    // Verificar si la cuenta está bloqueada
    console.log('🔍 Verificando estado de bloqueo antes de verificar contraseña...');
    const lockStatus = await isAccountLocked(user.id);
    console.log('📊 Estado de bloqueo recibido:', lockStatus);
    
    if (lockStatus.locked) {
      console.log('🔒 CUENTA BLOQUEADA detectada para usuario:', user.username);
      // Si está bloqueada y se proporciona código, verificarlo
      if (unlockCode) {
        console.log('   Código de desbloqueo proporcionado, verificando...');
        const codeVerification = await verifyUnlockCode(user.id, unlockCode);
        
        if (!codeVerification.valid) {
          console.log('   ❌ Código inválido:', codeVerification.error);
          return res.status(400).json({ 
            error: 'Código de desbloqueo inválido',
            locked: true,
            message: codeVerification.error 
          });
        }
        
        // Código válido - cuenta desbloqueada, continuar con login
        console.log('✅ Cuenta desbloqueada con código válido');
      } else {
        // Está bloqueada y no se proporcionó código
        console.log('   ❌ No se proporcionó código de desbloqueo');
        return res.status(403).json({ 
          error: 'Cuenta bloqueada',
          locked: true,
          message: 'Tu cuenta ha sido bloqueada debido a múltiples intentos fallidos. Se ha enviado un código de desbloqueo a tu correo electrónico.' 
        });
      }
    } else {
      console.log('✅ Cuenta NO bloqueada, continuando con verificación de contraseña...');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('🔐 Contraseña válida:', isValidPassword);
    
    if (!isValidPassword) {
      console.log(`❌ Contraseña incorrecta para usuario: ${user.username} (ID: ${user.id})`);
      // Incrementar intentos fallidos
      try {
        const attemptResult = await incrementFailedAttempts(user.id);
        console.log(`📊 Resultado de incremento de intentos:`, attemptResult);
        
        if (attemptResult.blocked) {
          console.log(`🔒 Cuenta bloqueada después de ${attemptResult.attempts} intentos fallidos`);
          // La cuenta fue bloqueada
          // El código de desbloqueo está guardado en la BD, así que el usuario puede solicitar reenvío
          return res.status(403).json({ 
            error: 'Cuenta bloqueada',
            locked: true,
            message: 'Tu cuenta ha sido bloqueada debido a múltiples intentos fallidos. Se ha enviado un código de desbloqueo a tu correo electrónico.' 
          });
        }
        
        console.log(`⚠️ Intentos fallidos: ${attemptResult.attempts}, Restantes: ${attemptResult.remaining}`);
        return res.status(401).json({ 
          error: 'Credenciales inválidas',
          attempts: attemptResult.attempts,
          remaining: attemptResult.remaining,
          message: `Credenciales incorrectas. Te quedan ${attemptResult.remaining} intento(s).`
        });
      } catch (error) {
        console.error('❌ ERROR al procesar intentos fallidos:');
        console.error('   Mensaje:', error.message);
        console.error('   Stack completo:', error.stack);
        if (error.cause) {
          console.error('   Causa:', error.cause);
        }
        // Si falla el incremento de intentos, aún así devolver un error de credenciales
        // Pero loguear el error completo para diagnóstico
        return res.status(401).json({ 
          error: 'Credenciales inválidas',
          message: 'Credenciales incorrectas.'
        });
      }
    }

    // Login exitoso - resetear intentos fallidos
    await resetFailedAttempts(user.id);

    const token = generateToken(user);

    await registrarLog({
      usuario_id: user.id,
      accion: LogActions.LOGIN,
      modulo: LogModules.AUTH,
      descripcion: `Login exitoso - Usuario: ${user.username} (${user.rol})`,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        idioma_preferido: user.idioma_preferido || 'es'
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message || 'Error desconocido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/register', registerLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido'),
  body('username').notEmpty().withMessage('Username es requerido')
    .isLength({ min: 3 }).withMessage('Username debe tener al menos 3 caracteres'),
  body('password').notEmpty().withMessage('Password es requerido')
    .isLength({ min: 6 }).withMessage('Password debe tener al menos 6 caracteres'),
  body('nombre_completo').notEmpty().withMessage('Nombre completo es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, nombre_completo } = req.body;

    // 1. Verificar formato del email y rechazar emails temporales
    console.log(`🔍 Verificando formato del email: ${email}`);
    const formatCheck = verifyEmailFormat(email);
    if (!formatCheck.valid) {
      console.log(`❌ Email rechazado por formato: ${formatCheck.reason}`);
      return res.status(400).json({ 
        error: 'Email inválido', 
        details: formatCheck.reason 
      });
    }

    // 2. Verificar formato básico del dominio (rápido, no bloqueante)
    // La verificación SMTP completa se hace de forma asíncrona para no bloquear el registro
    console.log(`🔍 Verificando formato del email: ${email}`);
    // Solo verificar formato y dominios temporales (rápido)
    // La verificación SMTP completa se omite para no bloquear el registro
    // La verificación real será cuando el usuario ingrese el código

    // Verificar si el email ya existe
    const { data: existingEmail } = await supabase
      .from('usuario')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Verificar si el username ya existe
    const { data: existingUsers } = await supabase
      .from('usuario')
      .select('id')
      .eq('username', username)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Generar código de verificación de 6 dígitos
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Válido por 30 minutos

    console.log(`📧 Generando código de verificación (expira: ${expiresAt.toISOString()})`);

    // Insertar nuevo usuario (con email NO verificado)
    const { data: newUserData, error: insertError } = await supabase
      .from('usuario')
      .insert({
        username,
        email,
        password_hash,
        nombre_completo,
        rol: 'usuario',
        estado: false, // No activo hasta verificar email
        activo: false,
        email_verificado: false
      })
      .select('id, username, email, nombre_completo, rol, email_verificado')
      .single();

    if (insertError) {
      console.error('Error insertando usuario:', insertError);
      return res.status(500).json({ error: 'Error interno del servidor', details: insertError.message });
    }

    // Guardar código de verificación en la base de datos
    const { error: codeError } = await supabase
      .from('email_verification_codes')
      .insert({
        usuario_id: newUserData.id,
        codigo: verificationCode,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (codeError) {
      console.error('Error guardando código de verificación:', codeError);
      // Intentar eliminar el usuario creado
      await supabase.from('usuario').delete().eq('id', newUserData.id);
      return res.status(500).json({ error: 'Error interno del servidor', details: codeError.message });
    }

    // Enviar código de verificación por correo
    try {
      console.log(`📧 Enviando código de verificación a: ${email}`);
      await sendEmailVerificationCode(email, verificationCode, username);
      console.log(`✅ Código de verificación enviado exitosamente`);
    } catch (emailError) {
      console.error('⚠️ Error enviando correo de verificación:', emailError);
      // No fallar el registro si falla el correo, pero loguear el error
      // El código está guardado en BD, el usuario puede solicitar reenvío
    }

    res.status(201).json({
      message: 'Usuario registrado exitosamente. Por favor, verifica tu correo electrónico para activar tu cuenta.',
      email: email,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/forgot-password', passwordResetLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido')
], async (req, res) => {
  try {
    console.log('📧 Solicitud de recuperación de contraseña recibida');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Errores de validación:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    console.log(`   Email solicitado: ${email}`);

    // Buscar usuario por email
    console.log('   Buscando usuario en la base de datos...');
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username, email, nombre_completo')
      .eq('email', email)
      .eq('estado', true)
      .limit(1);

    // Siempre devolver el mismo mensaje por seguridad (no revelar si el email existe)
    if (userError) {
      console.error('❌ Error buscando usuario:', userError);
      return res.json({ 
        message: 'Si el email existe, se le enviará un correo de recuperación' 
      });
    }

    if (!users || users.length === 0) {
      console.log('   Usuario no encontrado con ese email');
      return res.json({ 
        message: 'Si el email existe, se le enviará un correo de recuperación' 
      });
    }

    const user = users[0];
    console.log(`   ✅ Usuario encontrado: ${user.username} (ID: ${user.id})`);

    // Generar token único y seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Calcular fecha de expiración (15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    console.log(`   Token de recuperación generado (expira: ${expiresAt.toISOString()})`);

    // Eliminar tokens anteriores no usados del mismo usuario
    console.log('   Eliminando tokens anteriores...');
    const { error: deleteError } = await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('usuario_id', user.id)
      .or('used.eq.false,used.eq.0');

    if (deleteError) {
      console.error('⚠️ Error eliminando tokens anteriores (continuando):', deleteError);
    }

    // Guardar token en la base de datos
    console.log('   Guardando nuevo token en la base de datos...');
    
    // Intentar con 0 primero (tipo numérico), si falla intentar con false (tipo boolean)
    let insertError;
    
    // Primero intentar con 0 (numérico)
    const result1 = await supabase
      .from('password_reset_tokens')
      .insert({
        usuario_id: user.id,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: 0
      });
    
    if (result1.error) {
      console.log('   Intentando con used: false (boolean)...');
      // Si falla, intentar con false (boolean)
      const result2 = await supabase
        .from('password_reset_tokens')
        .insert({
          usuario_id: user.id,
          token: resetToken,
          expires_at: expiresAt.toISOString(),
          used: false
        });
      
      insertError = result2.error;
    } else {
      insertError = result1.error;
    }

    if (insertError) {
      console.error('❌ Error guardando token de reset:', insertError.message);
      throw new Error(`Error guardando token de recuperación: ${insertError.message}`);
    }
    console.log('   ✅ Token de recuperación almacenado en BD');

    // Construir URL de reset (usar la URL del frontend sin imprimir el token en logs)
    const frontendUrl = envConfig.frontendUrl;
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Enviar correo
    try {
      console.log(`   Enviando correo de recuperación a: ${user.email}`);
      await sendPasswordResetEmail(user.email, resetToken, resetUrl);
      console.log(`✅ Correo de recuperación enviado exitosamente a: ${user.email}`);
    } catch (emailError) {
      console.error('❌ ERROR CRÍTICO enviando correo:');
      console.error('   Mensaje:', emailError.message);
      console.error('   Stack:', emailError.stack);
      // No fallar si el correo no se puede enviar, pero loguear el error
    }

    console.log('✅ Proceso de recuperación completado');
    res.json({ 
      message: 'Si el email existe, se le enviará un correo de recuperación'
    });
  } catch (error) {
    console.error('❌ ERROR en recuperación de contraseña:');
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar token de recuperación
router.get('/reset-password/:token', passwordResetLimiter, async (req, res) => {
  try {
    const { token } = req.params;

    // Buscar token en la base de datos
    const { data: tokens, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, usuario_id, expires_at, used')
      .eq('token', token)
      .eq('used', false)
      .limit(1);

    if (tokenError) {
      console.error('Error buscando token:', tokenError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ error: 'Token inválido o no encontrado' });
    }

    const tokenData = tokens[0];
    const expiresAt = new Date(tokenData.expires_at);

    // Verificar si el token ha expirado
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'El token ha expirado' });
    }

    // Obtener datos del usuario
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('email, username')
      .eq('id', tokenData.usuario_id)
      .limit(1);

    if (userError || !users || users.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    res.json({
      valid: true,
      email: user.email
    });
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Restablecer contraseña
router.post('/reset-password', passwordResetLimiter, [
  body('token').notEmpty().withMessage('Token es requerido'),
  body('password').notEmpty().withMessage('Password es requerido')
    .isLength({ min: 6 }).withMessage('Password debe tener al menos 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Buscar token en la base de datos
    const { data: tokens, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, usuario_id, expires_at, used')
      .eq('token', token)
      .eq('used', false)
      .limit(1);

    if (tokenError) {
      console.error('Error buscando token:', tokenError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ error: 'Token inválido o no encontrado' });
    }

    const tokenData = tokens[0];
    const expiresAt = new Date(tokenData.expires_at);

    // Verificar si el token ha expirado
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'El token ha expirado. Por favor, solicita uno nuevo.' });
    }

    // Obtener datos del usuario
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('email, username')
      .eq('id', tokenData.usuario_id)
      .limit(1);

    if (userError || !users || users.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    // Hashear nueva contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Actualizar contraseña del usuario
    const { error: updateError } = await supabase
      .from('usuario')
      .update({ password_hash })
      .eq('id', tokenData.usuario_id);

    if (updateError) {
      console.error('Error actualizando contraseña:', updateError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Marcar token como usado
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', tokenData.id);

    if (markUsedError) {
      console.error('Error marcando token como usado:', markUsedError);
      // No fallar si esto falla, la contraseña ya fue actualizada
    }

    // Registrar en log
    await registrarLog({
      usuario_id: tokenData.usuario_id,
      accion: LogActions.ACTUALIZAR,
      modulo: LogModules.AUTH,
      descripcion: `Contraseña restablecida exitosamente - Usuario: ${user.username}`,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    });

    res.json({
      message: 'Contraseña restablecida exitosamente'
    });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reenviar código de desbloqueo
router.post('/resend-unlock-code', otpVerificationLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Buscar usuario por email usando Supabase
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id')
      .eq('email', email)
      .eq('estado', 1)
      .limit(1);

    if (userError) {
      console.error('Error buscando usuario para reenvío:', userError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userError.message });
    }

    if (!users || users.length === 0) {
      return res.json({ 
        message: 'Si el email existe y la cuenta está bloqueada, se reenviará el código' 
      });
    }

    const { resendUnlockCode } = await import('../utils/unlockCodeService.js');
    const result = await resendUnlockCode(users[0].id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: 'Código de desbloqueo reenviado exitosamente' 
    });
  } catch (error) {
    console.error('Error reenviando código:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Verificar y desbloquear cuenta con código
router.post('/verify-unlock-code', otpVerificationLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido'),
  body('unlockCode').notEmpty().withMessage('Código es requerido')
    .isLength({ min: 6, max: 6 }).withMessage('Código debe tener 6 dígitos')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, unlockCode } = req.body;

    // Buscar usuario por email usando Supabase
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username')
      .eq('email', email)
      .eq('estado', 1)
      .limit(1);

    if (userError) {
      console.error('Error buscando usuario:', userError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userError.message });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    // Verificar código de desbloqueo
    const codeVerification = await verifyUnlockCode(user.id, unlockCode);

    if (!codeVerification.valid) {
      return res.status(400).json({ 
        error: codeVerification.error || 'Código inválido'
      });
    }

    // Código válido - cuenta desbloqueada
    res.json({
      message: 'Cuenta desbloqueada exitosamente',
      unlocked: true
    });
  } catch (error) {
    console.error('Error verificando código de desbloqueo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar código de email
router.post('/verify-email', otpVerificationLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido'),
  body('code').notEmpty().withMessage('Código es requerido')
    .isLength({ min: 6, max: 6 }).withMessage('Código debe tener 6 dígitos')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, code } = req.body;

    // Buscar usuario por email
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username, email, email_verificado')
      .eq('email', email)
      .limit(1);

    if (userError) {
      console.error('Error buscando usuario:', userError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userError.message });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    // Si ya está verificado, retornar éxito
    if (user.email_verificado) {
      return res.json({
        message: 'El email ya está verificado',
        verified: true
      });
    }

    // Buscar código de verificación
    const { data: codes, error: codeError } = await supabase
      .from('email_verification_codes')
      .select('id, codigo, expires_at, used')
      .eq('usuario_id', user.id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeError) {
      console.error('Error buscando código:', codeError);
      return res.status(500).json({ error: 'Error interno del servidor', details: codeError.message });
    }

    if (!codes || codes.length === 0) {
      return res.status(400).json({ error: 'Código no encontrado o ya usado' });
    }

    const codeRecord = codes[0];

    // Verificar si el código expiró
    const expiresAt = new Date(codeRecord.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
    }

    // Verificar si el código coincide
    if (codeRecord.codigo !== code) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Marcar código como usado y verificar email
    const { error: updateError } = await supabase
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);

    if (updateError) {
      console.error('Error marcando código como usado:', updateError);
      // Continuar de todas formas
    }

    // Actualizar usuario: verificar email y activar cuenta
    const { error: userUpdateError } = await supabase
      .from('usuario')
      .update({
        email_verificado: true,
        estado: true,
        activo: true
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('Error verificando email:', userUpdateError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userUpdateError.message });
    }

    res.json({
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.',
      verified: true
    });
  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reenviar código de verificación
router.post('/resend-verification-code', otpVerificationLimiter, [
  body('email').notEmpty().withMessage('Email es requerido')
    .isEmail().withMessage('Email debe ser válido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Buscar usuario por email
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username, email, email_verificado')
      .eq('email', email)
      .limit(1);

    if (userError) {
      console.error('Error buscando usuario:', userError);
      return res.status(500).json({ error: 'Error interno del servidor', details: userError.message });
    }

    if (!users || users.length === 0) {
      return res.json({ 
        message: 'Si el email existe y no está verificado, se reenviará el código' 
      });
    }

    const user = users[0];

    if (user.email_verificado) {
      return res.json({ 
        message: 'El email ya está verificado' 
      });
    }

    // Generar nuevo código
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    // Guardar código
    const { error: codeError } = await supabase
      .from('email_verification_codes')
      .insert({
        usuario_id: user.id,
        codigo: verificationCode,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (codeError) {
      console.error('Error guardando código:', codeError);
      return res.status(500).json({ error: 'Error interno del servidor', details: codeError.message });
    }

    // Enviar código
    try {
      await sendEmailVerificationCode(user.email, verificationCode, user.username);
      res.json({ 
        message: 'Código de verificación reenviado exitosamente' 
      });
    } catch (emailError) {
      console.error('Error enviando correo:', emailError);
      res.status(500).json({ error: 'Error enviando correo', details: emailError.message });
    }
  } catch (error) {
    console.error('Error reenviando código:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, envConfig.jwtSecret);
    
    // Verificar que el usuario aún existe y está activo
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id, username, nombre_completo, rol, idioma_preferido')
      .eq('id', decoded.id)
      .eq('estado', true)
      .limit(1);

    if (userError) {
      console.error('Error verificando usuario:', userError);
      return res.status(401).json({ error: 'Token inválido' });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      valid: true,
      user: users[0]
    });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
