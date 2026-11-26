import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export type SidebarTheme = 'elegant';

export interface ThemeConfig {
  tema_modo: 'light' | 'dark';
  tema_color_primario: string;
  tema_sidebar: SidebarTheme;
}

interface ThemeContextValue {
  theme: ThemeConfig;
  loadTheme: () => Promise<void>;
  setSidebarTheme: (newSidebarTheme: SidebarTheme) => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
}

const DEFAULT_PRIMARY_HEX = '#b91c1c';

function hexToHsl(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function getInitialTheme(): ThemeConfig {
  const savedMode = localStorage.getItem('theme_mode');

  return {
    tema_modo: savedMode === 'dark' ? 'dark' : 'light',
    tema_color_primario: DEFAULT_PRIMARY_HEX,
    tema_sidebar: 'elegant',
  };
}

export function applyThemeToDom(themeConfig: ThemeConfig) {
  const root = document.documentElement;
  const body = document.body;

  if (themeConfig.tema_modo === 'dark') {
    root.classList.add('dark');
    body.classList.add('dark');
  } else {
    root.classList.remove('dark');
    body.classList.remove('dark');
  }

  const hsl = hexToHsl(themeConfig.tema_color_primario);
  if (hsl) {
    // Asegurar contraste WCAG AA tanto en modo claro como oscuro
    const adjustedL =
      themeConfig.tema_modo === 'dark' ? Math.max(48, Math.min(68, hsl.l)) : Math.max(32, Math.min(48, hsl.l));
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${adjustedL}%`);
    root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${adjustedL}%`);
    root.style.setProperty('--primary-foreground', adjustedL > 64 ? '224 25% 12%' : '0 0% 99%');
  }
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [theme, setTheme] = useState<ThemeConfig>(getInitialTheme);

  const loadTheme = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      const localTheme = getInitialTheme();
      setTheme(localTheme);
      applyThemeToDom(localTheme);
      return;
    }

    try {
      const config = await apiClient.getConfiguracion();
      const serverMode = config.tema_modo === 'dark' ? 'dark' : 'light';

      const newTheme: ThemeConfig = {
        tema_modo: serverMode,
        tema_color_primario: config.tema_color_primario || DEFAULT_PRIMARY_HEX,
        tema_sidebar: 'elegant',
      };

      localStorage.setItem('theme_mode', newTheme.tema_modo);

      setTheme((prev) => {
        if (
          prev.tema_modo === newTheme.tema_modo &&
          prev.tema_color_primario === newTheme.tema_color_primario
        ) {
          return prev;
        }
        return newTheme;
      });
      applyThemeToDom(newTheme);
    } catch (error) {
      console.error('Error cargando tema:', error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTheme();
    } else {
      applyThemeToDom(getInitialTheme());
    }
  }, [isAuthenticated, loadTheme]);

  const setSidebarTheme = useCallback((_newSidebarTheme: SidebarTheme) => {
    setTheme((prev) => ({ ...prev, tema_sidebar: 'elegant' }));
  }, []);

  const setThemeMode = useCallback((mode: 'light' | 'dark') => {
    localStorage.setItem('theme_mode', mode);
    setTheme((prev) => {
      const updated = { ...prev, tema_modo: mode };
      applyThemeToDom(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, loadTheme, setSidebarTheme, setThemeMode }),
    [theme, loadTheme, setSidebarTheme, setThemeMode]
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context) {
    return context;
  }

  const fallbackTheme = getInitialTheme();
  return {
    theme: fallbackTheme,
    loadTheme: async () => {
      applyThemeToDom(getInitialTheme());
    },
    setSidebarTheme: () => {},
    setThemeMode: (mode: 'light' | 'dark') => {
      localStorage.setItem('theme_mode', mode);
      applyThemeToDom({ ...getInitialTheme(), tema_modo: mode });
    },
  };
};
