import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Save,
  RotateCcw,
  Building2,
  Palette,
  Moon,
  Sun,
  Languages,
  Globe,
  Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function Configuracion() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const { loadTheme, setThemeMode } = useTheme();
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking");
  const [loading, setLoading] = useState(false);
  const [userLanguage, setUserLanguage] = useState<string>("es");
  const [applyLanguageGlobally, setApplyLanguageGlobally] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const previousThemeRef = useRef<string>("light");
  const isAdmin = user?.rol === "admin";

  const [config, setConfig] = useState({
    dojo_nombre: "",
    dojo_lema: "",
    dojo_direccion: "",
    dojo_telefono: "",
    dojo_email: "",
    dojo_facebook: "",
    dojo_instagram: "",
    dojo_twitter: "",
    dojo_whatsapp: "",
    dojo_logo_url: "",
    dojo_fondo_url: "",
    tema_modo: "light",
  });

  useEffect(() => {
    loadConfiguration();
    if (isAdmin) {
      checkConnection();
    }
    loadLanguagePreferences();
  }, [isAdmin]);

  const loadLanguagePreferences = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const userData = await apiClient.verifyToken();
          setUserLanguage(userData?.user?.idioma_preferido || "es");
        } catch {
          setUserLanguage(isEnglish ? "en" : "es");
        }
      }
    } catch {
      setUserLanguage("es");
    }
  };

  const loadConfiguration = async () => {
    try {
      const data = await apiClient.getConfiguracion();
      setConfig((prev) => ({
        ...prev,
        ...data,
        tema_modo: data.tema_modo === "dark" ? "dark" : "light",
      }));
      previousThemeRef.current = data.tema_modo || "light";
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  const checkConnection = async () => {
    setStatus("checking");
    try {
      await apiClient.getAlumnos();
      setStatus("connected");
    } catch {
      setStatus("error");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        await apiClient.updateConfiguracion(config);
        window.dispatchEvent(new CustomEvent("dojo-config-updated"));
      }

      localStorage.setItem("theme_mode", config.tema_modo);

      if (userLanguage) {
        if (isAdmin && applyLanguageGlobally) {
          await apiClient.cambiarIdiomaGlobal(userLanguage);
        } else {
          await apiClient.cambiarIdioma(userLanguage);
        }
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("language-change", {
              detail: { idioma_preferido: userLanguage },
            })
          );
        }, 50);
      }

      toast({
        title: isEnglish ? "Configuration saved!" : "¡Configuración guardada!",
        description: isEnglish
          ? "Changes have been applied successfully"
          : "Los cambios se han aplicado correctamente",
      });

      const temaCambio = previousThemeRef.current !== config.tema_modo;
      if (temaCambio) {
        if (isAdmin) {
          await loadTheme();
        } else {
          setThemeMode(config.tema_modo === "dark" ? "dark" : "light");
        }
        previousThemeRef.current = config.tema_modo;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Could not save configuration" : "No se pudo guardar la configuración"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setConfirmResetOpen(false);
    if (!isAdmin) return;

    setLoading(true);
    try {
      await apiClient.resetConfiguracion();
      await loadConfiguration();
      await loadTheme();
      window.dispatchEvent(new CustomEvent("dojo-config-updated"));
      toast({
        title: isEnglish ? "Settings restored" : "Configuración restaurada",
        description: isEnglish ? "Default values have been restored" : "Se han restaurado los valores por defecto",
      });
    } catch {
      toast({
        title: "Error",
        description: isEnglish ? "Could not restore configuration" : "No se pudo restaurar la configuración",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTemaMode = () => {
    const nuevoModo = config.tema_modo === "light" ? "dark" : "light";
    setConfig((prev) => ({ ...prev, tema_modo: nuevoModo }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {isEnglish ? "System Configuration" : "Configuración del Sistema"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEnglish
              ? "Customize institutional identity, language, and visual theme"
              : "Personaliza la identidad institucional del dojo, idioma y modo visual"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setConfirmResetOpen(true)}
              disabled={loading}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {isEnglish ? "Restore Defaults" : "Restaurar"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading} className="gap-2 active:scale-[0.98]">
            <Save className="h-4 w-4" />
            {loading ? (isEnglish ? "Saving..." : "Guardando...") : isEnglish ? "Save Changes" : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={isAdmin ? "dojo" : "tema"} className="w-full">
        <TabsList className={`grid w-full max-w-xl ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
          {isAdmin && (
            <TabsTrigger value="dojo">
              <Building2 className="h-4 w-4 mr-2" />
              {isEnglish ? "Dojo Identity" : "Identidad del Dojo"}
            </TabsTrigger>
          )}
          <TabsTrigger value="tema">
            <Palette className="h-4 w-4 mr-2" />
            {isEnglish ? "Preferences" : "Preferencias"}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="sistema">
              <CheckCircle className="h-4 w-4 mr-2" />
              {isEnglish ? "System" : "Sistema"}
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB: Identidad del Dojo (Solo Admin) */}
        {isAdmin && (
          <TabsContent value="dojo" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{isEnglish ? "Institutional Data" : "Datos Institucionales"}</CardTitle>
                <CardDescription>
                  {isEnglish
                    ? "Displayed dynamically in the sidebar, header, and reports"
                    : "Se muestran dinámicamente en la barra superior, el menú lateral y los reportes"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dojo_nombre">{isEnglish ? "Dojo Name *" : "Nombre del Dojo *"}</Label>
                    <Input
                      id="dojo_nombre"
                      value={config.dojo_nombre}
                      onChange={(e) => handleChange("dojo_nombre", e.target.value)}
                      placeholder={isEnglish ? "Ex: Sakura Dojo" : "Ej: Dojo Sakura"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dojo_email">{isEnglish ? "Contact Email" : "Email de Contacto"}</Label>
                    <Input
                      id="dojo_email"
                      type="email"
                      value={config.dojo_email}
                      onChange={(e) => handleChange("dojo_email", e.target.value)}
                      placeholder={isEnglish ? "contact@mydojo.com" : "contacto@midojo.com"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dojo_lema">
                    {isEnglish ? "Motto or Institutional Phrase" : "Lema o Frase Institucional"}
                  </Label>
                  <Input
                    id="dojo_lema"
                    value={config.dojo_lema}
                    onChange={(e) => handleChange("dojo_lema", e.target.value)}
                    placeholder={isEnglish ? "Ex: Discipline, honor and constancy" : "Ej: Disciplina, honor y constancia"}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dojo_direccion">{isEnglish ? "Address" : "Dirección"}</Label>
                    <Input
                      id="dojo_direccion"
                      value={config.dojo_direccion}
                      onChange={(e) => handleChange("dojo_direccion", e.target.value)}
                      placeholder={isEnglish ? "Street, city" : "Av., edificio, ciudad"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dojo_telefono">{isEnglish ? "Phone" : "Teléfono"}</Label>
                    <Input
                      id="dojo_telefono"
                      value={config.dojo_telefono}
                      onChange={(e) => handleChange("dojo_telefono", e.target.value)}
                      placeholder="+58 412 1234567"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      {isEnglish
                        ? "Class schedules and holidays are managed directly in the Schedules module."
                        : "Los horarios de clases y días festivos se gestionan de forma estructurada en el módulo de Horarios."}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/horarios">{isEnglish ? "Go to Schedules" : "Ir a Horarios"}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEnglish ? "Social Media & Brand Assets" : "Redes Sociales y Logotipo"}</CardTitle>
                <CardDescription>
                  {isEnglish ? "Optional social links and official logo URL" : "Enlaces opcionales y URL del logotipo institucional"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dojo_logo_url">{isEnglish ? "Logo URL" : "URL del Logo"}</Label>
                    <Input
                      id="dojo_logo_url"
                      value={config.dojo_logo_url}
                      onChange={(e) => handleChange("dojo_logo_url", e.target.value)}
                      placeholder="https://ejemplo.com/logo.png"
                    />
                    {config.dojo_logo_url && (
                      <img
                        src={config.dojo_logo_url}
                        alt={isEnglish ? "Logo preview" : "Vista previa del logo"}
                        className="mt-2 h-16 w-16 rounded-lg object-cover border"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dojo_whatsapp">WhatsApp</Label>
                    <Input
                      id="dojo_whatsapp"
                      value={config.dojo_whatsapp}
                      onChange={(e) => handleChange("dojo_whatsapp", e.target.value)}
                      placeholder="https://wa.me/584121234567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dojo_instagram">Instagram</Label>
                    <Input
                      id="dojo_instagram"
                      value={config.dojo_instagram}
                      onChange={(e) => handleChange("dojo_instagram", e.target.value)}
                      placeholder="https://instagram.com/midojo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dojo_facebook">Facebook</Label>
                    <Input
                      id="dojo_facebook"
                      value={config.dojo_facebook}
                      onChange={(e) => handleChange("dojo_facebook", e.target.value)}
                      placeholder="https://facebook.com/midojo"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* TAB: Preferencias */}
        <TabsContent value="tema" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                {isEnglish ? "Interface Language" : "Idioma de la Interfaz"}
              </CardTitle>
              <CardDescription>
                {isEnglish
                  ? "Independent from country document/currency rules"
                  : "Independiente del país configurado para validaciones de cédula y moneda"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="language-select">
                  {isEnglish ? "Preferred Language" : "Idioma Preferido"}
                </Label>
                <Select value={userLanguage} onValueChange={setUserLanguage}>
                  <SelectTrigger id="language-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="p-4 bg-muted/50 rounded-lg border flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <Label htmlFor="apply-globally" className="font-medium cursor-pointer">
                        {isEnglish ? "Apply to All Users" : "Aplicar a Todos los Usuarios"}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {applyLanguageGlobally
                        ? isEnglish
                          ? "Updates the default language for every user account."
                          : "Establece este idioma para todas las cuentas del sistema."
                        : isEnglish
                          ? "Applies only to your personal session."
                          : "Se aplicará únicamente a tu cuenta personal."}
                    </p>
                  </div>
                  <Switch
                    id="apply-globally"
                    checked={applyLanguageGlobally}
                    onCheckedChange={setApplyLanguageGlobally}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isEnglish ? "Visual Mode" : "Modo Visual"}</CardTitle>
              <CardDescription>
                {isEnglish
                  ? "Switch between high-contrast Light and Dark themes"
                  : "Alterna entre modo claro y modo oscuro con contraste accesible WCAG AA"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
                <div className="flex items-center gap-3">
                  {config.tema_modo === "light" ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <Label className="text-base font-medium">
                      {config.tema_modo === "light"
                        ? isEnglish
                          ? "Light Mode"
                          : "Modo Claro"
                        : isEnglish
                          ? "Dark Mode"
                          : "Modo Oscuro"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {isEnglish
                        ? "Remembered across sessions and also available in the top bar"
                        : "Se guarda en tu perfil y también puedes alternarlo desde la barra superior"}
                    </p>
                  </div>
                </div>
                <Switch checked={config.tema_modo === "dark"} onCheckedChange={toggleTemaMode} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Sistema (Solo Admin) */}
        {isAdmin && (
          <TabsContent value="sistema" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <CardTitle>{isEnglish ? "API & Database Status" : "Estado de Conexión"}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === "connected" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">
                        {isEnglish ? "Connected" : "Conectado"}
                      </span>
                    </>
                  ) : status === "error" ? (
                    <>
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="text-destructive font-medium">
                        {isEnglish ? "Disconnected" : "Sin conexión"}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {isEnglish ? "Checking..." : "Verificando..."}
                    </span>
                  )}
                </div>
                <Button onClick={checkConnection} variant="outline" size="sm">
                  {isEnglish ? "Verify Connection" : "Verificar Conexión"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEnglish ? "Technical Stack" : "Información Técnica del Sistema"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">{isEnglish ? "Version:" : "Versión:"}</span>
                  <span className="font-medium">2.0.0</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">{isEnglish ? "Database Engine:" : "Motor de Base de Datos:"}</span>
                  <span className="font-medium">PostgreSQL (Supabase + RLS)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{isEnglish ? "Status:" : "Estado Operativo:"}</span>
                  <span className="font-medium text-emerald-600">{isEnglish ? "Active" : "Activo"}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title={isEnglish ? "Restore Default Configuration" : "Restaurar Configuración por Defecto"}
        description={
          isEnglish
            ? "Are you sure you want to restore institutional settings and visual defaults?"
            : "¿Estás seguro de restaurar la identidad institucional y apariencia a sus valores predeterminados?"
        }
        confirmText={isEnglish ? "Restore" : "Restaurar"}
        cancelText={isEnglish ? "Cancel" : "Cancelar"}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
