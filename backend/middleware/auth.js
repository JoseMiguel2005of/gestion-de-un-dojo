import jwt from 'jsonwebtoken';
import { envConfig } from '../config/env.js';
import { hasRoleAccess, normalizeRole } from '../config/permissions.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
      code: 'TOKEN_REQUIRED',
    });
  }

  jwt.verify(token, envConfig.jwtSecret, (err, user) => {
    if (err || !user) {
      return res.status(401).json({
        error: 'Token inválido o expirado',
        code: 'TOKEN_INVALID',
      });
    }
    req.user = {
      ...user,
      rol: normalizeRole(user.rol),
    };
    next();
  });
};

export const requireRole = (...allowedRoles) => {
  const flatRoles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida',
        code: 'TOKEN_REQUIRED',
      });
    }

    if (!hasRoleAccess(req.user.rol, flatRoles)) {
      return res.status(403).json({
        error: 'Acceso denegado: no tienes permisos suficientes para esta operación',
        code: 'FORBIDDEN_ROLE',
      });
    }

    next();
  };
};

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      rol: normalizeRole(user.rol),
    },
    envConfig.jwtSecret,
    { expiresIn: '24h' }
  );
};
