import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import dojoBackground from "@/assets/dojo-bg.jpg";

// Esquemas de validación con Zod (se crean dinámicamente según el idioma)
const createSchemas = (isEnglish: boolean) => {
  const loginSchema = z.object({
    email: z.string().email({ message: isEnglish ? "Email must be valid" : "Email debe ser válido" }),
    password: z.string().min(6, { message: isEnglish ? "Password must be at least 6 characters" : "La contraseña debe tener al menos 6 caracteres" }),
  });

  const registerSchema = z.object({
    email: z.string()
      .email({ message: isEnglish ? "Email must be valid" : "Email debe ser válido" })
      .max(100, { message: isEnglish ? "Email cannot exceed 100 characters" : "El email no puede exceder 100 caracteres" }),
    username: z.string()
      .min(3, { message: isEnglish ? "Username must be at least 3 characters" : "El nombre de usuario debe tener al menos 3 caracteres" })
      .max(20, { message: isEnglish ? "Username cannot exceed 20 characters" : "El nombre de usuario no puede exceder 20 caracteres" })
      .regex(/^[a-zA-Z0-9_]+$/, { message: isEnglish ? "Only letters, numbers and underscores allowed" : "Solo se permiten letras, números y guiones bajos" })
      .trim(),
    password: z.string()
      .min(6, { message: isEnglish ? "Password must be at least 6 characters" : "La contraseña debe tener al menos 6 caracteres" })
      .max(50, { message: isEnglish ? "Password cannot exceed 50 characters" : "La contraseña no puede exceder 50 caracteres" }),
    confirmPassword: z.string()
      .min(6, { message: isEnglish ? "Confirm your password" : "Confirme su contraseña" }),
    nombre_completo: z.string()
      .min(3, { message: isEnglish ? "Full name must be at least 3 characters" : "El nombre completo debe tener al menos 3 caracteres" })
      .max(100, { message: isEnglish ? "Full name cannot exceed 100 characters" : "El nombre completo no puede exceder 100 caracteres" })
      .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, { message: isEnglish ? "Only letters and spaces allowed" : "Solo se permiten letras y espacios" }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: isEnglish ? "Passwords do not match" : "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

  const forgotPasswordSchema = z.object({
    email: z.string().email({ message: isEnglish ? "Email must be valid" : "Email debe ser válido" }),
  });

  return { loginSchema, registerSchema, forgotPasswordSchema };
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  
  // Esquemas de validación según el idioma actual
  const { loginSchema, registerSchema, forgotPasswordSchema } = createSchemas(isEnglish);

  // Login form
  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Register form
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regNombreCompleto, setRegNombreCompleto] = useState("");

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Verificar si ya hay sesión activa
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = loginSchema.parse({
        email,
        password,
      });

      setLoading(true);
      
      await login(validated.email, validated.password);

      // Login exitoso - resetear estados
      setRemainingAttempts(null);

      toast({
        title: isEnglish ? "Welcome to the Dojo!" : "¡Bienvenido al Dojo!",
        description: isEnglish ? "You have successfully logged in" : "Has iniciado sesión exitosamente",
      });
      
      navigate("/");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: isEnglish ? "Validation error" : "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        const errorAny = error as any;
        const errorData = errorAny.data || errorAny.response?.data || {};
        
        if (errorData.requiresVerification) {
          toast({
            title: isEnglish ? "Email verification required" : "Verificación de email pendiente",
            description: errorData.message || (isEnglish
              ? "Please verify your email address before signing in."
              : "Por favor, verifica tu correo electrónico antes de iniciar sesión."),
          });
          setTimeout(() => {
            navigate(`/verify-email?email=${encodeURIComponent(email)}`);
          }, 1200);
        } else if (errorData.locked) {
          toast({
            title: isEnglish ? "Account locked" : "Cuenta bloqueada",
            description: errorData.message || (isEnglish 
              ? "Your account has been locked. You will be redirected to unlock it." 
              : "Tu cuenta ha sido bloqueada. Serás redirigido para desbloquearla."),
            variant: "destructive",
          });
          setTimeout(() => {
            navigate(`/unlock-account?email=${encodeURIComponent(email)}`);
          }, 1200);
        } else if (errorData.inactive) {
          toast({
            title: isEnglish ? "Account deactivated" : "Cuenta desactivada",
            description: errorData.message || (isEnglish
              ? "Your account is currently deactivated. Contact the dojo administrator."
              : "Tu cuenta se encuentra desactivada. Contacta al administrador del dojo."),
            variant: "destructive",
          });
        } else if (errorData.attempts !== undefined || errorData.remaining !== undefined) {
          setRemainingAttempts(errorData.remaining);
          toast({
            title: isEnglish ? "Incorrect credentials" : "Credenciales incorrectas",
            description: errorData.message || (isEnglish
              ? `Incorrect credentials. ${errorData.remaining} attempt(s) remaining.`
              : `Credenciales incorrectas. Te quedan ${errorData.remaining} intento(s).`),
            variant: "destructive",
          });
        } else {
          toast({
            title: isEnglish ? "Authentication error" : "Error de autenticación",
            description: error instanceof Error ? error.message : (isEnglish ? "Incorrect credentials" : "Credenciales incorrectas"),
            variant: "destructive",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };
  

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = registerSchema.parse({
        email: regEmail,
        username: regUsername,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        nombre_completo: regNombreCompleto,
      });

      setLoading(true);
      const response = await api.register(
        validated.email,
        validated.username,
        validated.password,
        validated.nombre_completo
      );

      // Verificar si requiere verificación de email
      if (response.requiresVerification) {
        toast({
          title: isEnglish ? "Registration successful!" : "¡Registro exitoso!",
          description: isEnglish 
            ? "Please verify your email to activate your account" 
            : "Por favor, verifica tu email para activar tu cuenta",
        });
        
        // Redirigir a la página de verificación de email
        navigate(`/verify-email?email=${encodeURIComponent(validated.email)}`);
      } else {
        // Si no requiere verificación (caso antiguo), guardar token y redirigir
        if (response.token) {
          api.setToken(response.token);
        }
        
        toast({
          title: isEnglish ? "Registration successful!" : "¡Registro exitoso!",
          description: isEnglish ? "Your account has been created successfully" : "Tu cuenta ha sido creada correctamente",
        });
        
        navigate("/");
        window.location.reload();
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: isEnglish ? "Validation error" : "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: isEnglish ? "Registration error" : "Error en el registro",
          description: error.message || (isEnglish ? "Could not create account" : "No se pudo crear la cuenta"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = forgotPasswordSchema.parse({
        email: forgotEmail,
      });

      setLoading(true);
      await api.forgotPassword(validated.email);

      toast({
        title: isEnglish ? "Request sent" : "Solicitud enviada",
        description: isEnglish ? "If the email exists, recovery information will be sent" : "Si el email existe, se le enviará información de recuperación",
      });
      
      setForgotEmail("");
      setActiveTab("login");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: isEnglish ? "Validation error" : "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: isEnglish ? "Error" : "Error",
          description: error.message || (isEnglish ? "Could not process request" : "No se pudo procesar la solicitud"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };


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

      {/* Auth Card */}
      <Card className="w-full max-w-md mx-4 backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="text-6xl">🥋</div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            {isEnglish ? "Judo Dojo" : "Dojo de Judo"}
          </CardTitle>
          <CardDescription className="text-base">
            {isEnglish ? "Management and Administration System" : "Sistema de Gestión y Administración"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">{isEnglish ? "Login" : "Iniciar Sesión"}</TabsTrigger>
              <TabsTrigger value="register">{isEnglish ? "Register" : "Registrarse"}</TabsTrigger>
              <TabsTrigger value="forgot">{isEnglish ? "Recover" : "Recuperar"}</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={isEnglish ? "your@email.com" : "tu@email.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{isEnglish ? "Password" : "Contraseña"}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {isEnglish 
                        ? `${remainingAttempts} attempt(s) remaining`
                        : `Te quedan ${remainingAttempts} intento(s)`
                      }
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEnglish ? "Login" : "Iniciar Sesión"}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={isEnglish ? "your@email.com" : "tu@email.com"}
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-nombre">{isEnglish ? "Full Name" : "Nombre Completo"}</Label>
                  <Input
                    id="reg-nombre"
                    type="text"
                    placeholder={isEnglish ? "John Doe" : "Juan Pérez"}
                    value={regNombreCompleto}
                    onChange={(e) => setRegNombreCompleto(e.target.value)}
                    minLength={3}
                    maxLength={100}
                    pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+"
                    title={isEnglish ? "Only letters and spaces (3-100 characters)" : "Solo letras y espacios (3-100 caracteres)"}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-username">{isEnglish ? "Username" : "Nombre de Usuario"}</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder={isEnglish ? "user123" : "usuario123"}
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    minLength={3}
                    maxLength={20}
                    pattern="[a-zA-Z0-9_]+"
                    title={isEnglish ? "Only letters, numbers and underscores (3-20 characters)" : "Solo letras, números y guiones bajos (3-20 caracteres)"}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{isEnglish ? "Password" : "Contraseña"}</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    maxLength={50}
                    title={isEnglish ? "Between 6 and 50 characters" : "Entre 6 y 50 caracteres"}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm-password">{isEnglish ? "Confirm Password" : "Confirmar Contraseña"}</Label>
                  <Input
                    id="reg-confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    minLength={6}
                    maxLength={50}
                    title={isEnglish ? "Must match the password" : "Debe coincidir con la contraseña"}
                    required
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEnglish ? "Create Account" : "Crear Cuenta"}
                </Button>
              </form>
            </TabsContent>

            {/* Forgot Password Tab */}
            <TabsContent value="forgot">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder={isEnglish ? "your@email.com" : "tu@email.com"}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isEnglish ? "Enter your email to recover your password" : "Ingresa tu email para recuperar tu contraseña"}
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEnglish ? "Send Request" : "Enviar Solicitud"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
