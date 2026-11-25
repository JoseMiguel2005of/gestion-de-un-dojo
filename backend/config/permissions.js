export const ROLES = Object.freeze({
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  ASISTENTE: 'asistente',
  RECEPCIONISTA: 'recepcionista',
  USUARIO: 'usuario',
});

export const STAFF_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.ASISTENTE,
  ROLES.RECEPCIONISTA,
]);

export const ACADEMIC_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.ASISTENTE,
]);

export const MANAGEMENT_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
]);

export const ADMIN_ONLY = Object.freeze([ROLES.ADMIN]);

export function normalizeRole(role) {
  if (!role || typeof role !== 'string') return ROLES.USUARIO;
  const lower = role.trim().toLowerCase();
  if (lower === 'sensei') return ROLES.INSTRUCTOR;
  if (Object.values(ROLES).includes(lower)) return lower;
  return ROLES.USUARIO;
}

export function hasRoleAccess(userRole, allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalized = normalizeRole(userRole);
  return allowedRoles.map(normalizeRole).includes(normalized);
}
