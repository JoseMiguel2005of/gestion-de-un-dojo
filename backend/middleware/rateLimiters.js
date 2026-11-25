import rateLimit from 'express-rate-limit';

const createAuthLimiter = (max, windowMinutes, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Demasiadas solicitudes',
      message,
    },
  });

export const authGeneralLimiter = createAuthLimiter(
  60,
  15,
  'Has realizado demasiadas solicitudes de autenticación. Intenta nuevamente en 15 minutos.'
);

export const loginLimiter = createAuthLimiter(
  10,
  15,
  'Demasiados intentos de inicio de sesión desde esta IP. Intenta nuevamente en 15 minutos.'
);

export const registerLimiter = createAuthLimiter(
  10,
  15,
  'Demasiados intentos de registro desde esta IP. Intenta nuevamente en 15 minutos.'
);

export const passwordResetLimiter = createAuthLimiter(
  5,
  15,
  'Demasiadas solicitudes de restablecimiento de contraseña. Intenta nuevamente en 15 minutos.'
);

export const otpVerificationLimiter = createAuthLimiter(
  10,
  15,
  'Demasiados intentos de verificación de código. Espera 15 minutos antes de volver a intentarlo.'
);
