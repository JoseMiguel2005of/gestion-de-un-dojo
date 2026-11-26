import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function HorariosAdminTab() {
  const { isEnglish } = useLanguage();
  const [horarios, setHorarios] = useState<any[]>([]);
  const [festivos, setFestivos] = useState<any[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<{ tipo: "horario" | "festivo"; id: string } | null>(null);

  const cargarHorariosYFestivos = useCallback(async () => {
    try {
      const [hData, fData] = await Promise.all([
        apiClient.getHorarios(),
        apiClient.getDiasFestivos(),
      ]);
      setHorarios(hData || []);
      setFestivos(fData || []);
    } catch (error) {
      console.error("Error cargando horarios en administración:", error);
    }
  }, []);

  useEffect(() => {
    void cargarHorariosYFestivos();
  }, [cargarHorariosYFestivos]);

  const confirmarEliminacion = async () => {
    if (!confirmTarget) return;
    const { tipo, id } = confirmTarget;
    setConfirmTarget(null);

    try {
      if (tipo === "horario") {
        await apiClient.deleteHorario(id);
        toast({ title: isEnglish ? "Schedule deleted" : "Horario eliminado" });
      } else {
        await apiClient.deleteDiaFestivo(id);
        toast({ title: isEnglish ? "Holiday deleted" : "Día festivo eliminado" });
      }
      void cargarHorariosYFestivos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>{isEnglish ? "Registered Class Schedules" : "Horarios de Clases Registrados"}</CardTitle>
            <CardDescription>
              {isEnglish
                ? "Create and edit weekly schedules from the dedicated Schedules module"
                : "Puedes crear y editar horarios completos desde el módulo dedicado de Horarios"}
            </CardDescription>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/horarios">
              <ExternalLink className="h-4 w-4" />
              {isEnglish ? "Open Full Schedule Editor" : "Abrir Editor de Horarios"}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEnglish ? "Day" : "Día"}</TableHead>
                <TableHead>{isEnglish ? "Hours" : "Horario"}</TableHead>
                <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>{isEnglish ? "Capacity" : "Capacidad"}</TableHead>
                <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    {isEnglish ? "No schedules registered" : "No hay horarios registrados"}
                  </TableCell>
                </TableRow>
              ) : (
                horarios.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.dia_semana}</TableCell>
                    <TableCell>
                      {String(h.hora_inicio || "").substring(0, 5)} – {String(h.hora_fin || "").substring(0, 5)}
                    </TableCell>
                    <TableCell>{h.categoria_edad_nombre || (isEnglish ? "All" : "Todas")}</TableCell>
                    <TableCell>{h.instructor || "-"}</TableCell>
                    <TableCell>{h.capacidad_maxima || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmTarget({ tipo: "horario", id: String(h.id) })}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEnglish ? "Non-Working Holidays" : "Días Festivos Registrados"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {festivos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {isEnglish ? "No holidays registered" : "No hay días festivos registrados"}
            </p>
          ) : (
            festivos.map((f: any) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div>
                  <p className="font-medium">{f.descripcion}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${String(f.fecha).split("T")[0]}T12:00:00`).toLocaleDateString(
                      isEnglish ? "en-US" : "es-ES"
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmTarget({ tipo: "festivo", id: String(f.id) })}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={
          confirmTarget?.tipo === "horario"
            ? isEnglish
              ? "Delete Schedule"
              : "Eliminar Horario"
            : isEnglish
              ? "Delete Holiday"
              : "Eliminar Día Festivo"
        }
        description={
          confirmTarget?.tipo === "horario"
            ? isEnglish
              ? "Are you sure you want to delete this schedule?"
              : "¿Estás seguro de eliminar este horario de clase?"
            : isEnglish
              ? "Are you sure you want to delete this holiday?"
              : "¿Estás seguro de eliminar este día festivo?"
        }
        confirmText={isEnglish ? "Delete" : "Eliminar"}
        cancelText={isEnglish ? "Cancel" : "Cancelar"}
        onConfirm={confirmarEliminacion}
      />
    </div>
  );
}
