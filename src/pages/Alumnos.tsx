import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Eye, Users, Trash2, RotateCcw, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlumnoForm } from "@/components/forms/AlumnoForm";
import { AlumnoEditForm } from "@/components/forms/AlumnoEditForm";
import { AlumnoDetalle } from "@/components/AlumnoDetalle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage, translateBelt } from "@/hooks/useLanguage";

interface AccionPendienteAlumno {
  tipo: "eliminar" | "restaurar" | "eliminar_permanente";
  id: string;
  nombre?: string;
}

export default function Alumnos() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isAdmin = user?.rol === "admin";
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [alumnosEliminados, setAlumnosEliminados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"nombre" | "cedula">("nombre");
  const [activeTab, setActiveTab] = useState("activos");
  const [accionConfirmar, setAccionConfirmar] = useState<AccionPendienteAlumno | null>(null);

  useEffect(() => {
    fetchAlumnos();
    fetchAlumnosEliminados();
  }, []);

  useEffect(() => {
    if (activeTab === "eliminados") {
      fetchAlumnosEliminados();
    }
  }, [activeTab]);

  const fetchAlumnos = async () => {
    try {
      const data = await apiClient.getAlumnos();
      setAlumnos(data || []);
    } catch {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load students" : "No se pudieron cargar los alumnos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAlumnosEliminados = async () => {
    try {
      const eliminados = await apiClient.getAlumnosEliminados();
      setAlumnosEliminados(eliminados || []);
    } catch {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load archived students" : "No se pudieron cargar los alumnos archivados",
        variant: "destructive",
      });
    }
  };

  const filteredAlumnos = alumnos.filter((alumno) => {
    if (searchType === "cedula") {
      return (alumno.cedula || "").toLowerCase().includes(searchTerm.toLowerCase());
    }
    return (alumno.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEdit = (alumnoId: string) => {
    setSelectedAlumnoId(alumnoId);
    setEditDialogOpen(true);
  };

  const handleDetalle = (alumnoId: string) => {
    setSelectedAlumnoId(alumnoId);
    setDetalleDialogOpen(true);
  };

  const ejecutarAccionConfirmada = async () => {
    if (!accionConfirmar) return;
    const { tipo, id } = accionConfirmar;
    setAccionConfirmar(null);

    try {
      if (tipo === "eliminar") {
        await apiClient.deleteAlumno(id);
        toast({
          title: isEnglish ? "Student archived" : "Alumno desactivado",
          description: isEnglish ? "Student moved to archived tab" : "El alumno se movió a la pestaña de eliminados",
        });
        fetchAlumnos();
        fetchAlumnosEliminados();
      } else if (tipo === "restaurar") {
        await apiClient.restaurarAlumno(id);
        toast({
          title: isEnglish ? "Student restored" : "Alumno restaurado",
          description: isEnglish ? "Student restored successfully" : "El alumno fue restaurado exitosamente",
        });
        fetchAlumnosEliminados();
        fetchAlumnos();
      } else if (tipo === "eliminar_permanente") {
        await apiClient.deleteAlumnoPermanente(id);
        toast({
          title: isEnglish ? "Student permanently deleted" : "Alumno eliminado permanentemente",
          description: isEnglish
            ? "All records associated with the student were removed"
            : "El registro fue eliminado definitivamente de la base de datos",
        });
        fetchAlumnosEliminados();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Operation failed" : "No se pudo completar la acción"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {isEnglish ? "Student Management" : "Gestión de Alumnos"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEnglish ? "Manage active and archived dojo students" : "Administra la matrícula activa e histórica del dojo"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              {isEnglish ? "Register Student" : "Registrar Alumno"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEnglish ? "Register New Student" : "Registrar Nuevo Alumno"}</DialogTitle>
              <DialogDescription>
                {isEnglish
                  ? "Complete the form to register a new student in the dojo."
                  : "Completa el formulario para inscribir un nuevo alumno en el dojo."}
              </DialogDescription>
            </DialogHeader>
            <AlumnoForm
              onSuccess={() => {
                setDialogOpen(false);
                fetchAlumnos();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{isEnglish ? "Search Student" : "Buscar Alumno"}</CardTitle>
          </div>
          <CardDescription>
            {isEnglish ? "Filter students by full name or ID document" : "Filtra alumnos por nombre completo o documento de identidad"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={searchType} onValueChange={(value: "nombre" | "cedula") => setSearchType(value)}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nombre">{isEnglish ? "By Name" : "Por Nombre"}</SelectItem>
                <SelectItem value="cedula">{isEnglish ? "By ID" : "Por Cédula"}</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchType === "nombre"
                    ? isEnglish
                      ? "Search by name..."
                      : "Buscar por nombre..."
                    : isEnglish
                      ? "Search by ID..."
                      : "Buscar por cédula..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
          <TabsTrigger value="activos">
            {isEnglish ? "Active Students" : "Alumnos Activos"} ({filteredAlumnos.length})
          </TabsTrigger>
          <TabsTrigger value="eliminados">
            {isEnglish ? "Archived" : "Eliminados"} ({alumnosEliminados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activos">
          <Card>
            <CardHeader>
              <CardTitle>{isEnglish ? "Student Roster" : "Nómina de Alumnos"}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {filteredAlumnos.length} {isEnglish ? "student(s) found" : "alumno(s) encontrado(s)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEnglish ? "ID" : "Cédula"}</TableHead>
                    <TableHead>{isEnglish ? "Name" : "Nombre"}</TableHead>
                    <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                    <TableHead>{isEnglish ? "Belt" : "Cinta"}</TableHead>
                    <TableHead>{isEnglish ? "Instructor" : "Instructor"}</TableHead>
                    <TableHead>{isEnglish ? "Status" : "Estado"}</TableHead>
                    <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "Loading..." : "Cargando..."}
                      </TableCell>
                    </TableRow>
                  ) : filteredAlumnos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "No students registered" : "No hay alumnos registrados"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlumnos.map((alumno) => (
                      <TableRow key={alumno.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {alumno.cedula || "N/A"}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{alumno.nombre}</TableCell>
                        <TableCell>
                          {alumno.categoria_edad_nombre ? (
                            <Badge variant="outline">{alumno.categoria_edad_nombre}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {isEnglish ? "No category" : "Sin categoría"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {alumno.cinta_nombre ? translateBelt(alumno.cinta_nombre, isEnglish) : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {alumno.instructor_nombre || (isEnglish ? "Unassigned" : "Sin asignar")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={alumno.estado ? "default" : "secondary"}
                            className={alumno.estado ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                          >
                            {alumno.estado ? (isEnglish ? "Active" : "Activo") : isEnglish ? "Inactive" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDetalle(String(alumno.id))}
                              title={isEnglish ? "View file" : "Ver ficha"}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(String(alumno.id))}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {isEnglish ? "Edit" : "Editar"}
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setAccionConfirmar({
                                    tipo: "eliminar",
                                    id: String(alumno.id),
                                    nombre: alumno.nombre,
                                  })
                                }
                                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eliminados">
          <Card>
            <CardHeader>
              <CardTitle>{isEnglish ? "Archived Students" : "Alumnos Eliminados"}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {alumnosEliminados.length} {isEnglish ? "archived student(s)" : "alumno(s) desactivado(s)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEnglish ? "ID" : "Cédula"}</TableHead>
                    <TableHead>{isEnglish ? "Name" : "Nombre"}</TableHead>
                    <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                    <TableHead>{isEnglish ? "Instructor" : "Instructor"}</TableHead>
                    <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnosEliminados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "No archived students" : "No hay alumnos eliminados"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    alumnosEliminados.map((alumno) => (
                      <TableRow key={alumno.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {alumno.cedula || "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">{alumno.nombre}</TableCell>
                        <TableCell>{alumno.categoria_edad_nombre || "-"}</TableCell>
                        <TableCell>{alumno.instructor_nombre || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setAccionConfirmar({
                                  tipo: "restaurar",
                                  id: String(alumno.id),
                                  nombre: alumno.nombre,
                                })
                              }
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              {isEnglish ? "Restore" : "Restaurar"}
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  setAccionConfirmar({
                                    tipo: "eliminar_permanente",
                                    id: String(alumno.id),
                                    nombre: alumno.nombre,
                                  })
                                }
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                {isEnglish ? "Delete Forever" : "Eliminar Definitivamente"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Edit Student" : "Editar Alumno"}</DialogTitle>
            <DialogDescription>
              {isEnglish ? "Modify student information" : "Modifica los datos personales y académicos del alumno"}
            </DialogDescription>
          </DialogHeader>
          {selectedAlumnoId && (
            <AlumnoEditForm
              alumnoId={selectedAlumnoId}
              onSuccess={() => {
                setEditDialogOpen(false);
                fetchAlumnos();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Student Details" : "Ficha del Alumno"}</DialogTitle>
          </DialogHeader>
          {selectedAlumnoId && <AlumnoDetalle alumnoId={selectedAlumnoId} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(accionConfirmar)}
        onOpenChange={(open) => {
          if (!open) setAccionConfirmar(null);
        }}
        title={
          accionConfirmar?.tipo === "eliminar_permanente"
            ? isEnglish
              ? "Permanently Delete Student"
              : "Eliminar Alumno Permanentemente"
            : accionConfirmar?.tipo === "restaurar"
              ? isEnglish
                ? "Restore Student"
                : "Restaurar Alumno"
              : isEnglish
                ? "Archive Student"
                : "Desactivar Alumno"
        }
        description={
          accionConfirmar?.tipo === "eliminar_permanente"
            ? isEnglish
              ? `This action is irreversible. Student "${accionConfirmar?.nombre || ""}" and all their payments, evaluations, and attendance records will be permanently deleted.`
              : `Esta acción es irreversible. Se eliminará permanentemente al alumno "${accionConfirmar?.nombre || ""}" junto con sus pagos, evaluaciones y asistencias.`
            : accionConfirmar?.tipo === "restaurar"
              ? isEnglish
                ? `Do you want to reactivate student "${accionConfirmar?.nombre || ""}"?`
                : `¿Deseas reactivar al alumno "${accionConfirmar?.nombre || ""}" y su acceso al sistema?`
              : isEnglish
                ? `Do you want to archive "${accionConfirmar?.nombre || ""}"? You can restore them later from the Archived tab.`
                : `¿Deseas mover a "${accionConfirmar?.nombre || ""}" a la pestaña de Eliminados? Podrás restaurarlo en cualquier momento.`
        }
        variant={accionConfirmar?.tipo === "restaurar" ? "default" : "destructive"}
        confirmText={
          accionConfirmar?.tipo === "restaurar"
            ? isEnglish
              ? "Restore"
              : "Restaurar"
            : isEnglish
              ? "Confirm"
              : "Confirmar"
        }
        cancelText={isEnglish ? "Cancel" : "Cancelar"}
        onConfirm={ejecutarAccionConfirmada}
      />
    </div>
  );
}
