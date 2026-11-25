import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { hasRoleAccess, type UserRole } from "@/config/permissions";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const { isEnglish } = useLanguage();

  const isAllowed = user ? hasRoleAccess(user.rol, allowedRoles) : false;

  useEffect(() => {
    if (!loading && isAuthenticated && user && !isAllowed) {
      toast({
        title: isEnglish ? "Access restricted" : "Acceso restringido",
        description: isEnglish
          ? "You do not have permission to view this section."
          : "No tienes permisos para acceder a esta sección.",
        variant: "destructive",
      });
    }
  }, [loading, isAuthenticated, user, isAllowed, isEnglish]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
