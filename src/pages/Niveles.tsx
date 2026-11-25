import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Award, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NivelForm, CINTAS_CANONICAS } from "@/components/forms/NivelForm";
import { NivelEditForm } from "@/components/forms/NivelEditForm";
import { useLanguage, translateBelt } from "@/hooks/useLanguage";
import { hasRoleAccess, ACADEMIC_ROLES } from "@/config/permissions";

export default function Niveles() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isAdmin = user?.rol === "admin";
  const canManageAcademic = hasRoleAccess(user?.rol, ACADEMIC_ROLES);

  const [categorias, setCategorias] = useState<any[]>([]);
  const [cintas, setCintas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);

  // Estado para modal de cintas
  const [cintaDialogOpen, setCintaDialogOpen] = useState(false);
  const [editingCinta, setEditingCinta] = useState<any | null>(null);
  const [cintaForm, setCintaForm] = useState({
    nombre: "",
    nombre_en: "",
    color_hex: "#FFFFFF",
    orden: 1,
    es_dan: false,
    nivel_dan: 1,
  });
  const [savingCinta, setSavingCinta] = useState(false);

  const fetchCatalogos = async () => {
    setLoading(true);
    try {
      const [catsData, cintasData] = await Promise.all([
        apiClient.getCategoriasEdad(),
        apiClient.getCintas(),
      ]);
      setCategorias(catsData || []);
      setCintas(cintasData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load categories and belts" : "No se pudieron cargar las categorías y cintas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, []);

  const handleEditCategoria = (id: string) => {
    setSelectedCategoriaId(id);
    setEditDialogOpen(true);
  };

  const handleDeleteCategoria = async (id: string) => {
    if (
      !confirm(
        isEnglish
          ? "Are you sure you want to delete this age category?"
          : "¿Estás seguro de eliminar esta categoría de edad?"
      )
    )
      return;

    try {
      await apiClient.deleteCategoriaEdad(id);
      toast({
        title: isEnglish ? "Category deleted" : "Categoría eliminada",
        description: isEnglish ? "Category removed successfully" : "La categoría fue eliminada correctamente",
      });
      fetchCatalogos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openCreateCinta = () => {
    setEditingCinta(null);
    setCintaForm({
      nombre: "",
      nombre_en: "",
      color_hex: "#FFFFFF",
      orden: cintas.length + 1,
      es_dan: false,
      nivel_dan: 1,
    });
    setCintaDialogOpen(true);
  };

  const openEditCinta = (cinta: any) => {
    setEditingCinta(cinta);
    setCintaForm({
      nombre: cinta.nombre || "",
      nombre_en: cinta.nombre_en || "",
      color_hex: cinta.color_hex || "#FFFFFF",
      orden: Number(cinta.orden || 1),
      es_dan: Boolean(cinta.es_dan),
      nivel_dan: Number(cinta.nivel_dan || 1),
    });
    setCintaDialogOpen(true);
  };

  const handleSaveCinta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cintaForm.nombre.trim()) {
      toast({
        title: "Error",
        description: isEnglish ? "Belt name is required" : "El nombre de la cinta es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSavingCinta(true);
    try {
      const payload = {
        nombre: cintaForm.nombre.trim(),
        nombre_en: cintaForm.nombre_en.trim() || null,
        color_hex: cintaForm.color_hex,
        orden: Number(cintaForm.orden) || 1,
        es_dan: Boolean(cintaForm.es_dan),
        nivel_dan: cintaForm.es_dan ? Number(cintaForm.nivel_dan) || 1 : null,
      };

      if (editingCinta) {
        await apiClient.updateCinta(String(editingCinta.id), payload);
        toast({
          title: isEnglish ? "Belt updated" : "Cinta actualizada",
          description: isEnglish ? "Belt updated successfully" : "Los datos de la cinta fueron actualizados",
        });
      } else {
        await apiClient.createCinta(payload);
        toast({
          title: isEnglish ? "Belt created" : "Cinta creada",
          description: isEnglish ? "New belt registered" : "Nueva cinta registrada correctamente",
        });
      }

      setCintaDialogOpen(false);
      fetchCatalogos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingCinta(false);
    }
  };

  const handleDeleteCinta = async (cintaId: string) => {
    if (
      !confirm(
        isEnglish
          ? "Are you sure you want to delete this belt?"
          : "¿Estás seguro de eliminar esta cinta?"
      )
    )
      return;

    try {
      await apiClient.deleteCinta(cintaId);
      toast({
        title: isEnglish ? "Belt deleted" : "Cinta eliminada",
      });
      fetchCatalogos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getColorHexForBeltName = (beltName?: string | null) => {
    if (!beltName) return "#94a3b8";
    const matchDb = cintas.find((c) => c.nombre?.toLowerCase() === beltName.toLowerCase());
    if (matchDb?.color_hex) return matchDb.color_hex;
    const matchCanon = CINTAS_CANONICAS.find((c) => c.nombre.toLowerCase() === beltName.toLowerCase());
    return matchCanon?.color_hex || "#94a3b8";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {isEnglish ? "Categories & Official Belts" : "Categorías de Edad y Cintas"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEnglish
              ? "Real age ranges, monthly fees, and belt progression system"
              : "Rangos de edad reales, mensualidades y sistema oficial de cinturones del dojo"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="categorias" className="gap-2">
            <Users className="h-4 w-4" />
            {isEnglish ? "Age Categories" : "Categorías de Edad"} ({categorias.length})
          </TabsTrigger>
          <TabsTrigger value="cintas" className="gap-2">
            <Award className="h-4 w-4" />
            {isEnglish ? "Belts" : "Cintas"} ({cintas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{isEnglish ? "Age Categories" : "Categorías de Edad Activas"}</CardTitle>
                <CardDescription>
                  {isEnglish
                    ? "Used directly in student enrollment, schedules, and monthly billing"
                    : "Conectadas directamente con inscripciones, horarios de clase y cálculo de mensualidades"}
                </CardDescription>
              </div>
              {canManageAcademic && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      {isEnglish ? "New Category" : "Nueva Categoría"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{isEnglish ? "Create Age Category" : "Crear Categoría de Edad"}</DialogTitle>
                      <DialogDescription>
                        {isEnglish
                          ? "Define age range, max belt, and monthly fee."
                          : "Define rango de edad, cinta máxima permitida y precio mensual."}
                      </DialogDescription>
                    </DialogHeader>
                    <NivelForm
                      onSuccess={() => {
                        setDialogOpen(false);
                        fetchCatalogos();
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEnglish ? "Order" : "Orden"}</TableHead>
                    <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                    <TableHead>{isEnglish ? "Age Range" : "Rango de Edad"}</TableHead>
                    <TableHead>{isEnglish ? "Max Belt" : "Cinta Máxima"}</TableHead>
                    <TableHead>{isEnglish ? "Monthly Fee (USD$)" : "Mensualidad (USD$)"}</TableHead>
                    {canManageAcademic && <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "Loading..." : "Cargando..."}
                      </TableCell>
                    </TableRow>
                  ) : categorias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "No age categories registered" : "No hay categorías de edad registradas"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    categorias.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">#{cat.orden ?? "-"}</TableCell>
                        <TableCell className="font-semibold text-foreground">{cat.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {cat.edad_min} – {cat.edad_max} {isEnglish ? "years" : "años"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cat.cinta_maxima ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="w-4 h-4 rounded border border-border"
                                style={{ backgroundColor: getColorHexForBeltName(cat.cinta_maxima) }}
                              />
                              <span className="text-sm">{translateBelt(cat.cinta_maxima, isEnglish)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                          USD$ {Number(cat.precio_mensualidad || 0).toFixed(2)}
                        </TableCell>
                        {canManageAcademic && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditCategoria(String(cat.id))}>
                                <Edit className="h-4 w-4 mr-1" />
                                {isEnglish ? "Edit" : "Editar"}
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteCategoria(String(cat.id))}
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cintas" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{isEnglish ? "Official Belt Hierarchy" : "Jerarquía Oficial de Cintas"}</CardTitle>
                <CardDescription>
                  {isEnglish
                    ? "Ordered progression used in student profiles and belt promotion exams"
                    : "Orden de ascenso oficial utilizado en fichas de alumnos y exámenes de promoción"}
                </CardDescription>
              </div>
              {canManageAcademic && (
                <Button onClick={openCreateCinta} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isEnglish ? "New Belt" : "Nueva Cinta"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEnglish ? "Order" : "Orden"}</TableHead>
                    <TableHead>{isEnglish ? "Belt (ES)" : "Cinta (ES)"}</TableHead>
                    <TableHead>{isEnglish ? "Belt (EN)" : "Cinta (EN)"}</TableHead>
                    <TableHead>{isEnglish ? "Color" : "Color"}</TableHead>
                    <TableHead>{isEnglish ? "Rank Type" : "Tipo de Grado"}</TableHead>
                    {canManageAcademic && <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "Loading..." : "Cargando..."}
                      </TableCell>
                    </TableRow>
                  ) : cintas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "No belts registered" : "No hay cintas registradas"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    cintas.map((cinta) => (
                      <TableRow key={cinta.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">#{cinta.orden}</TableCell>
                        <TableCell className="font-semibold">{cinta.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{cinta.nombre_en || translateBelt(cinta.nombre, true)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-6 h-4 rounded border border-border shadow-sm"
                              style={{ backgroundColor: cinta.color_hex || "#FFFFFF" }}
                            />
                            <span className="font-mono text-xs text-muted-foreground">{cinta.color_hex}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {cinta.es_dan ? (
                            <Badge>Dan {cinta.nivel_dan ? `${cinta.nivel_dan}°` : ""}</Badge>
                          ) : (
                            <Badge variant="secondary">Kyu</Badge>
                          )}
                        </TableCell>
                        {canManageAcademic && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditCinta(cinta)}>
                                <Edit className="h-4 w-4 mr-1" />
                                {isEnglish ? "Edit" : "Editar"}
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteCinta(String(cinta.id))}
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Edit Age Category" : "Editar Categoría de Edad"}</DialogTitle>
            <DialogDescription>
              {isEnglish ? "Update age range, max belt, or monthly fee" : "Actualiza rango de edad, cinta máxima o mensualidad"}
            </DialogDescription>
          </DialogHeader>
          {selectedCategoriaId && (
            <NivelEditForm
              nivelId={selectedCategoriaId}
              onSuccess={() => {
                setEditDialogOpen(false);
                fetchCatalogos();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cintaDialogOpen} onOpenChange={setCintaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCinta
                ? isEnglish
                  ? "Edit Belt"
                  : "Editar Cinta"
                : isEnglish
                ? "Create New Belt"
                : "Crear Nueva Cinta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCinta} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Name (Spanish) *" : "Nombre (Español) *"}</Label>
                <Input
                  value={cintaForm.nombre}
                  onChange={(e) => setCintaForm({ ...cintaForm, nombre: e.target.value })}
                  placeholder="Ej: Blanco"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Name (English)" : "Nombre (Inglés)"}</Label>
                <Input
                  value={cintaForm.nombre_en}
                  onChange={(e) => setCintaForm({ ...cintaForm, nombre_en: e.target.value })}
                  placeholder="Ex: White"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Belt Color" : "Color Hexadecimal"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={cintaForm.color_hex}
                    onChange={(e) => setCintaForm({ ...cintaForm, color_hex: e.target.value })}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={cintaForm.color_hex}
                    onChange={(e) => setCintaForm({ ...cintaForm, color_hex: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Progression Order *" : "Orden de Ascenso *"}</Label>
                <Input
                  type="number"
                  min="1"
                  value={cintaForm.orden}
                  onChange={(e) => setCintaForm({ ...cintaForm, orden: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label className="font-medium">{isEnglish ? "Black Belt / Dan Grade" : "Grado Dan (Cinta Negra)"}</Label>
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "Enable if this belt represents a Dan rank" : "Activar si corresponde a Cinta Negra / Dan"}
                </p>
              </div>
              <Switch
                checked={cintaForm.es_dan}
                onCheckedChange={(checked) => setCintaForm({ ...cintaForm, es_dan: checked })}
              />
            </div>

            {cintaForm.es_dan && (
              <div className="space-y-2">
                <Label>{isEnglish ? "Dan Level" : "Nivel de Dan"}</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={cintaForm.nivel_dan}
                  onChange={(e) => setCintaForm({ ...cintaForm, nivel_dan: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCintaDialogOpen(false)}>
                {isEnglish ? "Cancel" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={savingCinta}>
                {savingCinta ? (isEnglish ? "Saving..." : "Guardando...") : isEnglish ? "Save" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
