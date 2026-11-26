/**
 * Verificación ligera de formato de correo electrónico y bloqueo de dominios desechables.
 * (La verificación real de propiedad se realiza mediante código OTP por correo).
 */
const TEMPORARY_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'temp-mail.org',
  'mohmal.com',
  'fakeinbox.com',
  'trashmail.com',
];

export const verifyEmailFormat = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Formato inválido' };
  }

  const partes = email.trim().split('@');
  if (partes.length !== 2 || !partes[0] || !partes[1] || !partes[1].includes('.')) {
    return { valid: false, reason: 'Formato inválido' };
  }

  const domainLower = partes[1].toLowerCase();
  if (TEMPORARY_DOMAINS.some((temp) => domainLower === temp || domainLower.endsWith(`.${temp}`))) {
    return { valid: false, reason: 'No se permiten emails temporales' };
  }

  return { valid: true };
};
