import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { normalizeRole } from '@/config/permissions';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  email?: string;
  nombre_completo: string;
  rol: string;
  idioma_preferido?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, unlockCode?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_AUTH_PATHS = ['/auth', '/reset-password', '/unlock-account', '/verify-email'];

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    apiClient.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          apiClient.setToken(token);
          const response = await apiClient.verifyToken();
          if (response.valid && response.user) {
            setUser({
              ...response.user,
              rol: normalizeRole(response.user.rol),
            });
          } else {
            localStorage.removeItem('auth_token');
            apiClient.setToken(null);
          }
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        localStorage.removeItem('auth_token');
        apiClient.setToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      apiClient.logout();
      setUser(null);
      setLoading(false);

      const currentPath = window.location.pathname;
      const isPublicPage = PUBLIC_AUTH_PATHS.some((path) => currentPath.startsWith(path));

      if (!isPublicPage) {
        toast({
          title: 'Sesión expirada',
          description: 'Tu sesión ha expirado o dejó de ser válida. Por favor, inicia sesión nuevamente.',
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string, unlockCode?: string) => {
    try {
      setLoading(true);
      const response = await apiClient.login(email, password, unlockCode);
      apiClient.setToken(response.token);
      setUser({
        ...response.user,
        rol: normalizeRole(response.user.rol),
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };
};

export { AuthContext };
export type { User, AuthContextType };
