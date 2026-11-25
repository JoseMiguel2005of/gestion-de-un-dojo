export type UserRole = 'admin' | 'instructor' | 'asistente' | 'recepcionista' | 'usuario';

export const ROLES: Record<string, UserRole> = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  ASISTENTE: 'asistente',
  RECEPCIONISTA: 'recepcionista',
  USUARIO: 'usuario',
};

export const ALL_AUTHENTICATED_ROLES: UserRole[] = [
  'admin',
  'instructor',
  'asistente',
  'recepcionista',
  'usuario',
];

export const STAFF_ROLES: UserRole[] = [
  'admin',
  'instructor',
  'asistente',
  'recepcionista',
];

export const ACADEMIC_ROLES: UserRole[] = [
  'admin',
  'instructor',
  'asistente',
];

export const REPORT_ROLES: UserRole[] = [
  'admin',
  'instructor',
];

export const ADMIN_ONLY_ROLES: UserRole[] = ['admin'];

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/': ALL_AUTHENTICATED_ROLES,
  '/alumnos': STAFF_ROLES,
  '/niveles': STAFF_ROLES,
  '/representantes': STAFF_ROLES,
  '/horarios': ALL_AUTHENTICATED_ROLES,
  '/evaluaciones': [...ACADEMIC_ROLES, 'usuario'],
  '/pagos': ALL_AUTHENTICATED_ROLES,
  '/reportes': REPORT_ROLES,
  '/configuracion': ALL_AUTHENTICATED_ROLES,
  '/configuracion-avanzada': ADMIN_ONLY_ROLES,
};

export function normalizeRole(role?: string | null): UserRole {
  if (!role) return 'usuario';
  const lower = role.trim().toLowerCase();
  if (lower === 'sensei') return 'instructor';
  if (lower === 'admin' || lower === 'instructor' || lower === 'asistente' || lower === 'recepcionista' || lower === 'usuario') {
    return lower;
  }
  return 'usuario';
}

export function hasRoleAccess(userRole: string | null | undefined, allowedRoles?: UserRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalized = normalizeRole(userRole);
  return allowedRoles.includes(normalized);
}

export function canAccessRoute(userRole: string | null | undefined, routePath: string): boolean {
  const allowed = ROUTE_PERMISSIONS[routePath];
  if (!allowed) return true;
  return hasRoleAccess(userRole, allowed);
}
