import { Home, Users, Award, UserCircle, FileText, BarChart3, Settings, Sliders, DollarSign, Clock } from "lucide-react";
import { NavLink } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { canAccessRoute } from "@/config/permissions";

const getMenuItems = (isEnglish: boolean) => [
  { title: isEnglish ? "Home" : "Inicio", url: "/", icon: Home },
  { title: isEnglish ? "Students" : "Alumnos", url: "/alumnos", icon: Users },
  { title: isEnglish ? "Categories" : "Categorías", url: "/niveles", icon: Award },
  { title: isEnglish ? "Representatives" : "Representantes", url: "/representantes", icon: UserCircle },
  { title: isEnglish ? "Schedules" : "Horarios", url: "/horarios", icon: Clock },
  { title: isEnglish ? "Payments" : "Pagos", url: "/pagos", icon: DollarSign },
  { title: isEnglish ? "Evaluations" : "Evaluaciones", url: "/evaluaciones", icon: FileText },
  { title: isEnglish ? "Reports" : "Reportes", url: "/reportes", icon: BarChart3 },
  { title: isEnglish ? "Settings" : "Configuración", url: "/configuracion", icon: Settings },
  { title: isEnglish ? "Advanced Config." : "Config. Avanzada", url: "/configuracion-avanzada", icon: Sliders },
];

export function SidebarClassic() {
  const { open } = useSidebar();
  const { user, loading } = useAuth();
  const { isEnglish } = useLanguage();
  
  const filteredMenuItems = !loading && user
    ? getMenuItems(isEnglish).filter((item) => canAccessRoute(user.rol, item.url))
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-gray-800 dark:bg-gray-950 border-r border-gray-700 dark:border-gray-900">
        <SidebarGroup>
          {/* Header clásico */}
          <div className="px-3 py-4 border-b border-gray-700 dark:border-gray-900">
            <SidebarGroupLabel className="flex items-center gap-2 text-white">
              <span className="text-2xl">🥋</span>
              {open && (
                <div>
                  <h2 className="text-base font-bold">Sistema Dojo</h2>
                  <p className="text-xs text-gray-400">Gestión</p>
                </div>
              )}
            </SidebarGroupLabel>
          </div>

          <SidebarGroupContent className="px-2 py-3">
            <SidebarMenu className="space-y-1">
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-orange-600 text-white font-medium shadow-md rounded-md"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-md"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>

          {/* Footer clásico */}
          {open && (
            <div className="mt-auto px-3 py-3 border-t border-gray-700 dark:border-gray-900">
              <p className="text-xs text-gray-500 text-center">v1.0.0 • 2025</p>
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

