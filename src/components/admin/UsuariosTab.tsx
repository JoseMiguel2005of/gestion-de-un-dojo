import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Plus, Power, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function UsuariosTab() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [dialogUsuarioAbierto, setDialogUsuarioAbierto] = useState(false);
  const [dialogPasswordAbierto, setDialogPasswordAbierto] = useState(false);

  const [nuevoUsuario, setNuevoUsuario] = useState({
    username: "",
    email: "",
    password: "",
    nombre_completo: "",
    rol: "instructor",
  });

  const [nuevaPassword, setNuevaPassword] = useState({
    password_actual: "",
    password_nueva: "",
    password_confirmar: "",
  });

  const cargarUsuarios = useCallback(async () => {
    try {
      const [usuariosData, rolesData] = await Promise.all([
        apiClient.getUsuarios(),
        apiClient.getRoles(),
      ]);
      setUsuarios(usuariosData || []);
      setRoles(rolesData || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    }
  }, []);

  useEffect(() => {
    void cargarUsuarios();
  }, [cargarUsuarios]);

  const crearUsuario = async () => {
    try {
      await apiClient.createUsuario(nuevoUsuario);
      toast({ title: isEnglish ? "User created successfully" : "Usuario creado exitosamente" });
      setDialogUsuarioAbierto(false);
      setNuevoUsuario({
        username: "",
        email: "",
        password: "",
        nombre_completo: "",
        rol: "instructor",
      });
      void cargarUsuarios();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const cambiarPassword = async () => {
    if (nuevaPassword.password_nueva !== nuevaPassword.password_confirmar) {
      toast({
        title: "Error",
        description: isEnglish ? "Passwords do not match" : "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }
    try {
      await apiClient.cambiarPassword(nuevaPassword.password_actual, nuevaPassword.password_nueva);
      toast({ title: isEnglish ? "Password updated" : "Contraseña cambiada exitosamente" });
      setDialogPasswordAbierto(false);
      setNuevaPassword({ password_actual: "", password_nueva: "", password_confirmar: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const cambiarRolUsuario = async (usuarioId: number | string, nuevoRol: string) => {
    try {
      await apiClient.updateUsuario(String(usuarioId), { rol: nuevoRol });
      toast({
        title: isEnglish ? "Role updated" : "Rol actualizado",
        description: `${isEnglish ? "Assigned role:" : "Nuevo rol asignado:"} ${nuevoRol}`,
      });
      void cargarUsuarios();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleEstadoUsuario = async (usuarioObj: any) => {
    try {
      const nuevoEstado = !usuarioObj.activo;
      await apiClient.updateUsuario(String(usuarioObj.id), { activo: nuevoEstado });
      toast({
        title: nuevoEstado
          ? isEnglish
            ? "Account activated"
            : "Cuenta activada"
          : isEnglish
            ? "Account deactivated"
            : "Cuenta desactivada",
        description: `${usuarioObj.nombre_completo || usuarioObj.username}`,
      });
      void cargarUsuarios();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const desbloquearCuentaUsuario = async (usuarioObj: any) => {
    try {
      const resp = await apiClient.desbloquearUsuario(usuarioObj.id);
      toast({
        title: isEnglish ? "Account unlocked" : "Cuenta desbloqueada",
        description: resp.message || usuarioObj.username,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>{isEnglish ? "User & Access Management" : "Gestión de Usuarios y Roles"}</CardTitle>
            <CardDescription>
              {isEnglish
                ? "Create staff accounts, assign RBAC roles, deactivate or unlock accounts"
                : "Crea cuentas de personal, asigna roles RBAC, activa/desactiva y desbloquea cuentas"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={dialogPasswordAbierto} onOpenChange={setDialogPasswordAbierto}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Key className="w-4 h-4 mr-1" />
                  {isEnglish ? "Change My Password" : "Cambiar mi contraseña"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEnglish ? "Change Password" : "Cambiar Contraseña"}</DialogTitle>
                  <DialogDescription>
                    {isEnglish ? "Update your current login password" : "Actualiza tu contraseña de acceso actual"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Current Password" : "Contraseña Actual"}</Label>
                    <Input
                      type="password"
                      value={nuevaPassword.password_actual}
                      onChange={(e) => setNuevaPassword({ ...nuevaPassword, password_actual: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEnglish ? "New Password" : "Nueva Contraseña"}</Label>
                    <Input
                      type="password"
                      value={nuevaPassword.password_nueva}
                      onChange={(e) => setNuevaPassword({ ...nuevaPassword, password_nueva: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Confirm New Password" : "Confirmar Nueva Contraseña"}</Label>
                    <Input
                      type="password"
                      value={nuevaPassword.password_confirmar}
                      onChange={(e) => setNuevaPassword({ ...nuevaPassword, password_confirmar: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={cambiarPassword}>
                    {isEnglish ? "Update Password" : "Cambiar Contraseña"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogUsuarioAbierto} onOpenChange={setDialogUsuarioAbierto}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  {isEnglish ? "New Staff User" : "Nuevo Usuario"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEnglish ? "Create Staff Account" : "Crear Nuevo Usuario"}</DialogTitle>
                  <DialogDescription>
                    {isEnglish
                      ? "Staff accounts are created verified and active immediately"
                      : "Las cuentas creadas por administración quedan activas y verificadas de inmediato"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Full Name" : "Nombre Completo"}</Label>
                    <Input
                      value={nuevoUsuario.nombre_completo}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre_completo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Username" : "Nombre de Usuario"}</Label>
                    <Input
                      value={nuevoUsuario.username}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={nuevoUsuario.email}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Initial Password" : "Contraseña Inicial"}</Label>
                    <Input
                      type="password"
                      value={nuevoUsuario.password}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEnglish ? "Role" : "Rol"}</Label>
                    <Select
                      value={nuevoUsuario.rol}
                      onValueChange={(value) => setNuevoUsuario({ ...nuevoUsuario, rol: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((rol: any) => (
                          <SelectItem key={rol.id} value={rol.nombre}>
                            {rol.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={crearUsuario}>
                    {isEnglish ? "Create User" : "Crear Usuario"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isEnglish ? "User" : "Usuario"}</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>{isEnglish ? "Role" : "Rol"}</TableHead>
              <TableHead>{isEnglish ? "Status" : "Estado"}</TableHead>
              <TableHead>{isEnglish ? "Last Login" : "Último Acceso"}</TableHead>
              <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario: any) => {
              const esPropioUsuario = String(usuario.id) === String(user?.id);
              return (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">
                    <div>{usuario.nombre_completo || usuario.username}</div>
                    <div className="text-xs text-muted-foreground">@{usuario.username}</div>
                  </TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    <Select
                      value={usuario.rol}
                      disabled={esPropioUsuario}
                      onValueChange={(nuevoRol) => cambiarRolUsuario(usuario.id, nuevoRol)}
                    >
                      <SelectTrigger className="w-[145px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="instructor">instructor</SelectItem>
                        <SelectItem value="asistente">asistente</SelectItem>
                        <SelectItem value="recepcionista">recepcionista</SelectItem>
                        <SelectItem value="usuario">usuario</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {usuario.activo ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                        {isEnglish ? "Active" : "Activo"}
                      </span>
                    ) : (
                      <span className="text-destructive font-medium text-sm">
                        {isEnglish ? "Inactive" : "Inactivo"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {usuario.ultimo_acceso
                      ? new Date(usuario.ultimo_acceso).toLocaleString(isEnglish ? "en-US" : "es-ES")
                      : isEnglish
                        ? "Never"
                        : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={esPropioUsuario}
                        onClick={() => toggleEstadoUsuario(usuario)}
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {usuario.activo
                          ? isEnglish
                            ? "Deactivate"
                            : "Desactivar"
                          : isEnglish
                            ? "Activate"
                            : "Activar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => desbloquearCuentaUsuario(usuario)}
                      >
                        <Unlock className="w-3.5 h-3.5 mr-1" />
                        {isEnglish ? "Unlock" : "Desbloquear"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
