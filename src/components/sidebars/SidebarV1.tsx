import { Home, Users, Award, UserCircle, FileText, BarChart3, Settings, Sliders, DollarSign, Clock, CalendarCheck } from "lucide-react";
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
  { title: isEnglish ? "Attendance" : "Asistencias", url: "/asistencias", icon: CalendarCheck },
  { title: isEnglish ? "Payments" : "Pagos", url: "/pagos", icon: DollarSign },
  { title: isEnglish ? "Evaluations" : "Evaluaciones", url: "/evaluaciones", icon: FileText },
  { title: isEnglish ? "Reports" : "Reportes", url: "/reportes", icon: BarChart3 },
  { title: isEnglish ? "Settings" : "Configuración", url: "/configuracion", icon: Settings },
  { title: isEnglish ? "Advanced Config." : "Config. Avanzada", url: "/configuracion-avanzada", icon: Sliders },
];

export function SidebarV1() {
  const { open } = useSidebar();
  const { user, loading } = useAuth();
  const { isEnglish } = useLanguage();
  
  const filteredMenuItems = !loading && user
    ? getMenuItems(isEnglish).filter((item) => canAccessRoute(user.rol, item.url))
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-r border-slate-700/50">
        <SidebarGroup>
          {/* Header mejorado */}
          <div className="px-4 py-6 border-b border-slate-700/50">
            <SidebarGroupLabel className="text-xl font-bold flex items-center gap-3 text-white hover:text-blue-400 transition-colors">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-2 rounded-lg shadow-lg">
                <span className="text-2xl">🥋</span>
              </div>
              {open && (
                <div className="flex flex-col">
                  <span className="text-lg">Sistema Dojo</span>
                  <span className="text-xs text-slate-400 font-normal">Gestión Integral</span>
                </div>
              )}
            </SidebarGroupLabel>
          </div>

          <SidebarGroupContent className="px-2 py-4">
            <SidebarMenu className="space-y-1">
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-blue-600 transition-all duration-200 rounded-lg"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white hover:shadow-md transition-all duration-200 rounded-lg hover:translate-x-1"
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>

          {/* Footer decorativo */}
          {open && (
            <div className="mt-auto px-4 py-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-500 text-center">
                <p className="font-semibold text-slate-400">v1.0.0</p>
                <p className="text-slate-600">© 2025 Dojo System</p>
              </div>
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

