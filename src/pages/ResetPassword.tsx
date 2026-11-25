import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import dojoBackground from "@/assets/dojo-bg.jpg";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        toast({
          title: isEnglish ? "Invalid link" : "Enlace inválido",
          description: isEnglish ? "The reset link is missing or invalid" : "El enlace de recuperación es inválido o no existe",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      try {
        setVerifying(true);
        const response = await api.verifyResetToken(token);
        
        if (response.valid && response.email) {
          setTokenValid(true);
          setEmail(response.email);
        } else {
          toast({
            title: isEnglish ? "Invalid or expired token" : "Token inválido o expirado",
            description: response.error || (isEnglish ? "The reset link has expired or is invalid. Please request a new one." : "El enlace de recuperación ha expirado o es inválido. Por favor, solicita uno nuevo."),
            variant: "destructive",
          });
          navigate("/auth");
        }
      } catch (error: any) {
        toast({
          title: isEnglish ? "Error" : "Error",
          description: error.message || (isEnglish ? "Could not verify the reset link" : "No se pudo verificar el enlace de recuperación"),
          variant: "destructive",
        });
        navigate("/auth");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, navigate, isEnglish]);

  const resetPasswordSchema = z.object({
    password: z.string().min(6, { 
      message: isEnglish ? "Password must be at least 6 characters" : "La contraseña debe tener al menos 6 caracteres" 
    }),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: isEnglish ? "Passwords do not match" : "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      return;
    }

    try {
      const validated = resetPasswordSchema.parse({
        password,
        confirmPassword,
      });

      setLoading(true);
      await api.resetPassword(token, validated.password);

      toast({
        title: isEnglish ? "Password reset successful!" : "¡Contraseña restablecida exitosamente!",
        description: isEnglish ? "You can now log in with your new password" : "Ahora puedes iniciar sesión con tu nueva contraseña",
      });

      navigate("/auth");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: isEnglish ? "Validation error" : "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: isEnglish ? "Error" : "Error",
          description: error instanceof Error ? error.message : (isEnglish ? "Could not reset password" : "No se pudo restablecer la contraseña"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="dark min-h-screen text-foreground flex items-center justify-center relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${dojoBackground})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-red-900/40" />
        </div>
        <Card className="w-full max-w-md mx-4 backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl relative z-10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {isEnglish ? "Verifying reset link..." : "Verificando enlace de recuperación..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return null;
  }

  return (
    <div className="dark min-h-screen text-foreground flex items-center justify-center relative overflow-hidden">
      {/* Background image with overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${dojoBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-red-900/40" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 text-6xl opacity-10 select-none">🥋</div>
      <div className="absolute bottom-10 right-10 text-6xl opacity-10 select-none">🥋</div>

      {/* Reset Password Card */}
      <Card className="w-full max-w-md mx-4 backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="text-6xl">🥋</div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            {isEnglish ? "Reset Password" : "Restablecer Contraseña"}
          </CardTitle>
          <CardDescription className="text-base">
            {isEnglish ? "Enter your new password below" : "Ingresa tu nueva contraseña a continuación"}
          </CardDescription>
          {email && (
            <CardDescription className="text-sm text-muted-foreground">
              {email}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{isEnglish ? "New Password" : "Nueva Contraseña"}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{isEnglish ? "Confirm Password" : "Confirmar Contraseña"}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEnglish ? "Reset Password" : "Restablecer Contraseña"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/auth")}
              disabled={loading}
            >
              {isEnglish ? "Back to Login" : "Volver al Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

