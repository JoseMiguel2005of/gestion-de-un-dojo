import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Award,
  UserCircle,
  FileText,
  BarChart3,
  Settings,
  Sliders,
  DollarSign,
  Clock,
  CalendarCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { canAccessRoute, normalizeRole } from "@/config/permissions";
import { apiClient } from "@/lib/api";

const getMenuSections = (isEnglish: boolean) => [
  {
    label: isEnglish ? "Main" : "Principal",
    items: [{ title: isEnglish ? "Home" : "Inicio", url: "/", icon: Home }],
  },
  {
    label: isEnglish ? "Dojo Management" : "Gestión del Dojo",
    items: [
      { title: isEnglish ? "Students" : "Alumnos", url: "/alumnos", icon: Users },
      { title: isEnglish ? "Categories & Belts" : "Categorías y Cintas", url: "/niveles", icon: Award },
      { title: isEnglish ? "Representatives" : "Representantes", url: "/representantes", icon: UserCircle },
      { title: isEnglish ? "Schedules" : "Horarios", url: "/horarios", icon: Clock },
      { title: isEnglish ? "Attendance" : "Asistencias", url: "/asistencias", icon: CalendarCheck },
    ],
  },
  {
    label: isEnglish ? "Academic & Billing" : "Académico y Finanzas",
    items: [
      { title: isEnglish ? "Evaluations" : "Evaluaciones", url: "/evaluaciones", icon: FileText },
      { title: isEnglish ? "Payments" : "Pagos", url: "/pagos", icon: DollarSign },
      { title: isEnglish ? "Reports" : "Reportes", url: "/reportes", icon: BarChart3 },
    ],
  },
  {
    label: isEnglish ? "System" : "Sistema",
    items: [
      { title: isEnglish ? "Settings" : "Configuración", url: "/configuracion", icon: Settings },
      { title: isEnglish ? "Advanced Admin" : "Administración", url: "/configuracion-avanzada", icon: Sliders },
    ],
  },
];

const ROLE_LABELS_ES: Record<string, string> = {
  admin: "Administrador",
  instructor: "Instructor",
  asistente: "Asistente",
  recepcionista: "Recepcionista",
  usuario: "Alumno",
};

const ROLE_LABELS_EN: Record<string, string> = {
  admin: "Administrator",
  instructor: "Instructor",
  asistente: "Assistant",
  recepcionista: "Receptionist",
  usuario: "Student",
};

export function AppSidebar() {
  const { open } = useSidebar();
  const { user, loading } = useAuth();
  const { isEnglish } = useLanguage();

  const [dojoBranding, setDojoBranding] = useState({
    nombre: "Dojo",
    lema: "",
    logoUrl: "",
    facebook: "",
    instagram: "",
    twitter: "",
    whatsapp: "",
  });

  const cargarBranding = async () => {
    try {
      const config = await apiClient.getConfiguracion();
      setDojoBranding({
        nombre: config.dojo_nombre?.trim() || "Dojo",
        lema: config.dojo_lema?.trim() || "",
        logoUrl: config.dojo_logo_url?.trim() || "",
        facebook: config.dojo_facebook?.trim() || "",
        instagram: config.dojo_instagram?.trim() || "",
        twitter: config.dojo_twitter?.trim() || "",
        whatsapp: config.dojo_whatsapp?.trim() || "",
      });
    } catch {
      // Usar valores por defecto en caso de sesión no lista
    }
  };

  useEffect(() => {
    cargarBranding();
    const onUpdated = () => {
      cargarBranding();
    };
    window.addEventListener("dojo-config-updated", onUpdated);
    return () => window.removeEventListener("dojo-config-updated", onUpdated);
  }, []);

  const filteredSections =
    !loading && user
      ? getMenuSections(isEnglish)
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => canAccessRoute(user.rol, item.url)),
          }))
          .filter((section) => section.items.length > 0)
      : [];

  const normalizedRole = normalizeRole(user?.rol);
  const roleLabel = isEnglish
    ? ROLE_LABELS_EN[normalizedRole] || normalizedRole
    : ROLE_LABELS_ES[normalizedRole] || normalizedRole;

  return (
    <Sidebar collapsible="icon" side="left" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar text-sidebar-foreground flex flex-col h-full">
        {/* Identidad institucional dinámica */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {dojoBranding.logoUrl ? (
              <img
                src={dojoBranding.logoUrl}
                alt={dojoBranding.nombre}
                className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 bg-muted"
              />
            ) : (
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-sm font-bold text-lg">
                🥋
              </div>
            )}
            {open && (
              <div className="min-w-0">
                <h2 className="text-base font-bold text-sidebar-foreground truncate">
                  {dojoBranding.nombre}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {dojoBranding.lema || (isEnglish ? "Management System" : "Sistema de Gestión")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navegación por secciones */}
        <div className="flex-1 overflow-y-auto py-3">
          {filteredSections.map((section) => (
            <SidebarGroup key={section.label} className="px-3 mb-4">
              {open && (
                <SidebarGroupLabel className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className={({ isActive }) =>
                            isActive
                              ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-semibold rounded-lg border-l-2 border-primary"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-lg"
                          }
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>

        {/* Pie con usuario activo y enlaces opcionales */}
        {open && user && (
          <div className="mt-auto border-t border-sidebar-border p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user.nombre_completo || user.username}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {roleLabel}
              </Badge>
            </div>

            {(dojoBranding.facebook ||
              dojoBranding.instagram ||
              dojoBranding.twitter ||
              dojoBranding.whatsapp) && (
              <div className="flex items-center justify-center gap-3 pt-1 border-t border-sidebar-border/60 text-xs text-muted-foreground">
                {dojoBranding.facebook && (
                  <a
                    href={dojoBranding.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    FB
                  </a>
                )}
                {dojoBranding.instagram && (
                  <a
                    href={dojoBranding.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    IG
                  </a>
                )}
                {dojoBranding.twitter && (
                  <a
                    href={dojoBranding.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    X
                  </a>
                )}
                {dojoBranding.whatsapp && (
                  <a
                    href={dojoBranding.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    WA
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
