import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Users, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RepresentanteForm } from "@/components/forms/RepresentanteForm";
import { RepresentanteEditForm } from "@/components/forms/RepresentanteEditForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/useLanguage";

export default function Representantes() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isAdmin = user?.rol === "admin";
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRepresentanteId, setSelectedRepresentanteId] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<"nombre" | "cedula">("nombre");
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  useEffect(() => {
    fetchRepresentantes();
  }, []);

  const fetchRepresentantes = async () => {
    try {
      const data = await apiClient.getRepresentantes();
      setRepresentantes(data || []);
    } catch {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load representatives" : "No se pudieron cargar los representantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRepresentantes = representantes.filter((rep) => {
    if (searchType === "cedula") {
      return (rep.cedula || "").toLowerCase().includes(searchTerm.toLowerCase());
    }
    return `${rep.nombre || ""} ${rep.apellido || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEdit = (representanteId: string) => {
    setSelectedRepresentanteId(representanteId);
    setEditDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!eliminarId) return;
    const id = eliminarId;
    setEliminarId(null);

    try {
      await apiClient.delete(`/representantes/${id}`);
      toast({
        title: isEnglish ? "Representative deleted" : "Representante eliminado",
        description: isEnglish ? "Representative deleted successfully" : "El representante se eliminó correctamente",
      });
      fetchRepresentantes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Could not delete representative" : "No se pudo eliminar el representante"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {isEnglish ? "Representative Management" : "Gestión de Representantes"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEnglish
              ? "Manage legal guardians for minor students"
              : "Administra los representantes legales de los alumnos menores de edad"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              {isEnglish ? "Register Representative" : "Registrar Representante"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEnglish ? "Register New Representative" : "Registrar Nuevo Representante"}</DialogTitle>
              <DialogDescription>
                {isEnglish
                  ? "Complete the form to register a legal guardian."
                  : "Completa el formulario para registrar un representante legal."}
              </DialogDescription>
            </DialogHeader>
            <RepresentanteForm
              onSuccess={() => {
                setDialogOpen(false);
                fetchRepresentantes();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{isEnglish ? "Search Representative" : "Buscar Representante"}</CardTitle>
          </div>
          <CardDescription>
            {isEnglish ? "Find representatives by name, last name, or ID" : "Encuentra representantes por nombre, apellido o cédula"}
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

      <Card>
        <CardHeader>
          <CardTitle>{isEnglish ? "Representative List" : "Lista de Representantes"}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {filteredRepresentantes.length} {isEnglish ? "representative(s) found" : "representante(s) encontrado(s)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEnglish ? "ID" : "Cédula"}</TableHead>
                <TableHead>{isEnglish ? "Name" : "Nombre"}</TableHead>
                <TableHead>{isEnglish ? "Phone" : "Teléfono"}</TableHead>
                <TableHead>{isEnglish ? "Email" : "Email"}</TableHead>
                <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isEnglish ? "Loading..." : "Cargando..."}
                  </TableCell>
                </TableRow>
              ) : filteredRepresentantes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isEnglish ? "No representatives registered" : "No hay representantes registrados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRepresentantes.map((rep) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{rep.cedula || "N/A"}</TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {[rep.nombre, rep.apellido].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell>{rep.telefono || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{rep.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(String(rep.id))}>
                          <Edit className="h-4 w-4 mr-1" />
                          {isEnglish ? "Edit" : "Editar"}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEliminarId(String(rep.id))}
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Edit Representative" : "Editar Representante"}</DialogTitle>
            <DialogDescription>
              {isEnglish ? "Modify representative data" : "Modifica los datos del representante"}
            </DialogDescription>
          </DialogHeader>
          {selectedRepresentanteId && (
            <RepresentanteEditForm
              representanteId={selectedRepresentanteId}
              onSuccess={() => {
                setEditDialogOpen(false);
                fetchRepresentantes();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(eliminarId)}
        onOpenChange={(open) => {
          if (!open) setEliminarId(null);
        }}
        title={isEnglish ? "Delete Representative" : "Eliminar Representante"}
        description={
          isEnglish
            ? "Are you sure you want to delete this representative? This action cannot be undone."
            : "¿Estás seguro de eliminar este representante? Esta acción no se puede deshacer."
        }
        confirmText={isEnglish ? "Delete" : "Eliminar"}
        cancelText={isEnglish ? "Cancel" : "Cancelar"}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
