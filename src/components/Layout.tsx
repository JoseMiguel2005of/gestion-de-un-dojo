import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { normalizeRole } from "@/config/permissions";
import { apiClient } from "@/lib/api";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "@/hooks/use-toast";

const ROLE_LABELS_ES: Record<string, string> = {
  admin: "Admin",
  instructor: "Instructor",
  asistente: "Asistente",
  recepcionista: "Recepción",
  usuario: "Alumno",
};

const ROLE_LABELS_EN: Record<string, string> = {
  admin: "Admin",
  instructor: "Instructor",
  asistente: "Assistant",
  recepcionista: "Reception",
  usuario: "Student",
};

export function Layout() {
  const navigate = useNavigate();
  const { user, loading, logout, isAuthenticated } = useAuth();
  const { isEnglish } = useLanguage();
  const { theme, setThemeMode } = useTheme();
  const [dojoNombre, setDojoNombre] = useState<string>("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const cargarNombre = async () => {
      try {
        const cfg = await apiClient.getConfiguracion();
        if (cfg?.dojo_nombre) {
          setDojoNombre(cfg.dojo_nombre.trim());
        }
      } catch {
        // Ignorar errores silenciosos de carga inicial
      }
    };
    cargarNombre();
    window.addEventListener("dojo-config-updated", cargarNombre);
    return () => window.removeEventListener("dojo-config-updated", cargarNombre);
  }, [isAuthenticated]);

  const handleLogout = () => {
    try {
      logout();
      toast({
        title: isEnglish ? "Session closed" : "Sesión cerrada",
        description: isEnglish ? "See you soon" : "Hasta pronto",
      });
      navigate("/auth");
    } catch {
      toast({
        title: "Error",
        description: isEnglish ? "Could not close session" : "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const normalizedRole = normalizeRole(user.rol);
  const roleLabel = isEnglish
    ? ROLE_LABELS_EN[normalizedRole] || normalizedRole
    : ROLE_LABELS_ES[normalizedRole] || normalizedRole;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-card/95 backdrop-blur border-b border-border px-4 md:px-6 shadow-sm gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-foreground hover:bg-muted shrink-0" />
              <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight truncate">
                {dojoNombre || (isEnglish ? "Dojo Management System" : "Sistema de Gestión de Dojo")}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground truncate max-w-[180px]">
                  {user.nombre_completo || user.username}
                </span>
                <Badge variant="outline" className="text-xs">
                  {roleLabel}
                </Badge>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setThemeMode(theme.tema_modo === "dark" ? "light" : "dark")}
                title={isEnglish ? "Toggle theme" : "Cambiar modo claro/oscuro"}
                aria-label={isEnglish ? "Toggle theme" : "Cambiar modo claro/oscuro"}
              >
                {theme.tema_modo === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="gap-2 active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {isEnglish ? "Sign Out" : "Cerrar Sesión"}
                </span>
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 overflow-x-hidden bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
