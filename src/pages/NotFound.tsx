import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";

const NotFound = () => {
  const location = useLocation();
  const { isEnglish } = useLanguage();

  useEffect(() => {
    console.warn("Ruta no encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
      <Card className="max-w-md w-full border-border shadow-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">404</h1>
            <h2 className="text-lg font-semibold">
              {isEnglish ? "Page not found" : "Página no encontrada"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEnglish
                ? `The requested path "${location.pathname}" does not exist or has been moved.`
                : `La ruta solicitada "${location.pathname}" no existe o fue movida.`}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              {isEnglish ? "Back to Dashboard" : "Volver al Inicio"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
