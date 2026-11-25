import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthContext, useAuthState } from "./hooks/useAuth";
import { LanguageProvider } from "./hooks/useLanguage";
import { ThemeProvider } from "./hooks/useTheme";
import { Layout } from "./components/Layout";
import { RoleGuard } from "./components/RoleGuard";
import { ROUTE_PERMISSIONS } from "./config/permissions";
import Dashboard from "./pages/Dashboard";
import Alumnos from "./pages/Alumnos";
import Niveles from "./pages/Niveles";
import Representantes from "./pages/Representantes";
import Horarios from "./pages/Horarios";
import Asistencias from "./pages/Asistencias";
import Pagos from "./pages/Pagos";
import Evaluaciones from "./pages/Evaluaciones";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";
import ConfiguracionAvanzada from "./pages/ConfiguracionAvanzada";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import UnlockAccount from "./pages/UnlockAccount";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unlock-account" element={<UnlockAccount />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/"]}>
                    <Dashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/alumnos"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/alumnos"]}>
                    <Alumnos />
                  </RoleGuard>
                }
              />
              <Route
                path="/niveles"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/niveles"]}>
                    <Niveles />
                  </RoleGuard>
                }
              />
              <Route
                path="/representantes"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/representantes"]}>
                    <Representantes />
                  </RoleGuard>
                }
              />
              <Route
                path="/horarios"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/horarios"]}>
                    <Horarios />
                  </RoleGuard>
                }
              />
              <Route
                path="/asistencias"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/asistencias"]}>
                    <Asistencias />
                  </RoleGuard>
                }
              />
              <Route
                path="/pagos"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/pagos"]}>
                    <Pagos />
                  </RoleGuard>
                }
              />
              <Route
                path="/evaluaciones"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/evaluaciones"]}>
                    <Evaluaciones />
                  </RoleGuard>
                }
              />
              <Route
                path="/reportes"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reportes"]}>
                    <Reportes />
                  </RoleGuard>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/configuracion"]}>
                    <Configuracion />
                  </RoleGuard>
                }
              />
              <Route
                path="/configuracion-avanzada"
                element={
                  <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/configuracion-avanzada"]}>
                    <ConfiguracionAvanzada />
                  </RoleGuard>
                }
              />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </AuthContext.Provider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
