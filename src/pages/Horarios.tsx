import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Calendar, Users, MapPin, AlertCircle, ChevronDown, ChevronUp, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage, getTranslation } from "@/hooks/useLanguage";

interface Horario {
  id: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  id_categoria_edad?: number | null;
  categoria_edad_nombre?: string | null;
  capacidad_maxima?: number | null;
  instructor_id?: number | null;
  instructor?: string | null;
  activo: boolean;
}

interface DiaFestivo {
  id: number;
  fecha: string;
  descripcion: string;
}

const DIAS_CATALOGO = [
  { key: "lunes", dbValue: "Lunes", es: "Lunes", en: "Monday", badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "martes", dbValue: "Martes", es: "Martes", en: "Tuesday", badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { key: "miercoles", dbValue: "Miércoles", es: "Miércoles", en: "Wednesday", badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { key: "jueves", dbValue: "Jueves", es: "Jueves", en: "Thursday", badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { key: "viernes", dbValue: "Viernes", es: "Viernes", en: "Friday", badgeClass: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { key: "sabado", dbValue: "Sábado", es: "Sábado", en: "Saturday", badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { key: "domingo", dbValue: "Domingo", es: "Domingo", en: "Sunday", badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
];

const MAPA_INGLES_A_CLAVE: Record<string, string> = {
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miercoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sabado",
  sunday: "domingo",
};

function obtenerClaveDiaCanonica(diaSemana: string): string {
  if (!diaSemana) return "";
  const limpio = diaSemana
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return MAPA_INGLES_A_CLAVE[limpio] || limpio;
}

export default function Horarios() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const canManageHorarios = ["admin", "instructor"].includes(user?.rol || "");

  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [diasFestivos, setDiasFestivos] = useState<DiaFestivo[]>([]);
  const [categoriasEdad, setCategoriasEdad] = useState<any[]>([]);
  const [instructores, setInstructores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [diasFestivosExpandidos, setDiasFestivosExpandidos] = useState(true);

  // CRUD Horarios
  const [horarioModalOpen, setHorarioModalOpen] = useState(false);
  const [editandoHorario, setEditandoHorario] = useState<Horario | null>(null);
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [formHorario, setFormHorario] = useState({
    dia_semana: "Lunes",
    hora_inicio: "16:00",
    hora_fin: "17:30",
    id_categoria_edad: "all",
    instructor_id: "none",
    capacidad_maxima: "20",
    activo: true,
  });

  // CRUD Festivos
  const [festivoModalOpen, setFestivoModalOpen] = useState(false);
  const [editandoFestivo, setEditandoFestivo] = useState<DiaFestivo | null>(null);
  const [guardandoFestivo, setGuardandoFestivo] = useState(false);
  const [formFestivo, setFormFestivo] = useState({
    fecha: "",
    descripcion: "",
  });

  useEffect(() => {
    loadData();
  }, [canManageHorarios]);

  const loadData = async () => {
    setLoading(true);
    try {
      const promesas: Promise<any>[] = [apiClient.getHorarios(), apiClient.getDiasFestivos()];
      if (canManageHorarios) {
        promesas.push(
          apiClient.getCategoriasEdad().catch(() => []),
          apiClient.getSenseisDisponibles().catch(() => [])
        );
      }

      const [horariosData, festivosData, categoriasData, instructoresData] = await Promise.all(promesas);

      const horariosUnicos = (horariosData || []).filter(
        (horario: Horario, index: number, self: Horario[]) =>
          index === self.findIndex((h) => h.id === horario.id)
      );
      setHorarios(horariosUnicos);
      setDiasFestivos(festivosData || []);
      if (canManageHorarios) {
        setCategoriasEdad(categoriasData || []);
        setInstructores(instructoresData || []);
      }
    } catch (error: any) {
      console.error("Error cargando horarios:", error);
      toast({
        title: "Error",
        description: isEnglish ? "Could not load schedules" : "No se pudieron cargar los horarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirNuevoHorario = () => {
    setEditandoHorario(null);
    setFormHorario({
      dia_semana: "Lunes",
      hora_inicio: "16:00",
      hora_fin: "17:30",
      id_categoria_edad: "all",
      instructor_id: "none",
      capacidad_maxima: "20",
      activo: true,
    });
    setHorarioModalOpen(true);
  };

  const abrirEditarHorario = (horario: Horario) => {
    const clave = obtenerClaveDiaCanonica(horario.dia_semana);
    const diaInfo = DIAS_CATALOGO.find((d) => d.key === clave);
    setEditandoHorario(horario);
    setFormHorario({
      dia_semana: diaInfo?.dbValue || horario.dia_semana || "Lunes",
      hora_inicio: (horario.hora_inicio || "16:00").substring(0, 5),
      hora_fin: (horario.hora_fin || "17:30").substring(0, 5),
      id_categoria_edad: horario.id_categoria_edad ? String(horario.id_categoria_edad) : "all",
      instructor_id: horario.instructor_id ? String(horario.instructor_id) : "none",
      capacidad_maxima: horario.capacidad_maxima ? String(horario.capacidad_maxima) : "",
      activo: horario.activo !== false,
    });
    setHorarioModalOpen(true);
  };

  const guardarHorario = async () => {
    if (!formHorario.hora_inicio || !formHorario.hora_fin || formHorario.hora_fin <= formHorario.hora_inicio) {
      toast({
        title: isEnglish ? "Invalid schedule" : "Horario inválido",
        description: isEnglish
          ? "End time must be after start time"
          : "La hora de finalización debe ser posterior a la hora de inicio",
        variant: "destructive",
      });
      return;
    }

    setGuardandoHorario(true);
    try {
      const payload = {
        dia_semana: formHorario.dia_semana,
        hora_inicio: formHorario.hora_inicio,
        hora_fin: formHorario.hora_fin,
        id_categoria_edad: formHorario.id_categoria_edad !== "all" ? Number(formHorario.id_categoria_edad) : null,
        instructor_id: formHorario.instructor_id !== "none" ? Number(formHorario.instructor_id) : null,
        capacidad_maxima: formHorario.capacidad_maxima ? Number(formHorario.capacidad_maxima) : null,
        activo: formHorario.activo,
      };

      if (editandoHorario) {
        await apiClient.updateHorario(String(editandoHorario.id), payload);
        toast({
          title: isEnglish ? "Schedule updated" : "Horario actualizado",
          description: isEnglish ? "Class schedule updated successfully" : "El horario se actualizó correctamente",
        });
      } else {
        await apiClient.createHorario(payload);
        toast({
          title: isEnglish ? "Schedule created" : "Horario creado",
          description: isEnglish ? "New class schedule created" : "Nuevo horario registrado exitosamente",
        });
      }
      setHorarioModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Could not save schedule" : "No se pudo guardar el horario"),
        variant: "destructive",
      });
    } finally {
      setGuardandoHorario(false);
    }
  };

  const eliminarHorario = async (id: number) => {
    if (!confirm(isEnglish ? "Delete this class schedule?" : "¿Eliminar este horario de clase?")) return;
    try {
      await apiClient.deleteHorario(String(id));
      toast({
        title: isEnglish ? "Schedule deleted" : "Horario eliminado",
        description: isEnglish ? "Class schedule removed" : "El horario fue eliminado correctamente",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const abrirNuevoFestivo = () => {
    setEditandoFestivo(null);
    setFormFestivo({ fecha: "", descripcion: "" });
    setFestivoModalOpen(true);
  };

  const abrirEditarFestivo = (festivo: DiaFestivo) => {
    setEditandoFestivo(festivo);
    setFormFestivo({
      fecha: festivo.fecha ? String(festivo.fecha).split("T")[0] : "",
      descripcion: festivo.descripcion || "",
    });
    setFestivoModalOpen(true);
  };

  const guardarFestivo = async () => {
    if (!formFestivo.fecha || !formFestivo.descripcion.trim()) {
      toast({
        title: isEnglish ? "Missing fields" : "Campos incompletos",
        description: isEnglish ? "Date and description are required" : "La fecha y descripción son obligatorias",
        variant: "destructive",
      });
      return;
    }

    setGuardandoFestivo(true);
    try {
      if (editandoFestivo) {
        await apiClient.updateDiaFestivo(String(editandoFestivo.id), {
          fecha: formFestivo.fecha,
          descripcion: formFestivo.descripcion.trim(),
        });
        toast({
          title: isEnglish ? "Holiday updated" : "Día festivo actualizado",
        });
      } else {
        await apiClient.createDiaFestivo({
          fecha: formFestivo.fecha,
          descripcion: formFestivo.descripcion.trim(),
        });
        toast({
          title: isEnglish ? "Holiday added" : "Día festivo agregado",
        });
      }
      setFestivoModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardandoFestivo(false);
    }
  };

  const eliminarFestivo = async (id: number) => {
    if (!confirm(isEnglish ? "Delete this holiday?" : "¿Eliminar este día festivo?")) return;
    try {
      await apiClient.deleteDiaFestivo(String(id));
      toast({
        title: isEnglish ? "Holiday deleted" : "Día festivo eliminado",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const horariosVisibles = canManageHorarios
    ? horarios
    : horarios.filter((h) => h.activo !== false);

  const horariosPorDia = DIAS_CATALOGO.reduce((acc, diaInfo) => {
    acc[diaInfo.key] = horariosVisibles
      .filter((h) => obtenerClaveDiaCanonica(h.dia_semana) === diaInfo.key)
      .sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
    return acc;
  }, {} as Record<string, Horario[]>);

  const totalClasesVisibles = Object.values(horariosPorDia).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
            <Clock className="h-8 w-8" />
            {isEnglish ? "Class Schedules" : "Horarios de Clases"}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {isEnglish
              ? "Check available class schedules and non-working holidays"
              : "Consulta y administra los horarios de clases y días festivos del dojo"}
          </p>
        </div>

        {canManageHorarios && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={abrirNuevoHorario} className="gap-2">
              <Plus className="h-4 w-4" />
              {isEnglish ? "New Schedule" : "Nuevo Horario"}
            </Button>
            <Button variant="outline" onClick={abrirNuevoFestivo} className="gap-2">
              <Calendar className="h-4 w-4" />
              {isEnglish ? "Add Holiday" : "Agregar Festivo"}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">{isEnglish ? "Loading schedules..." : "Cargando horarios..."}</p>
        </div>
      ) : (
        <>
          {totalClasesVisibles === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold">
                  {isEnglish ? "No class schedules available" : "No hay horarios de clases registrados"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {canManageHorarios
                    ? isEnglish
                      ? "Create the first weekly schedule so students and instructors can check class times and take attendance."
                      : "Registra el primer horario semanal para que los alumnos consulten sus clases y los instructores puedan pasar asistencia."
                    : isEnglish
                      ? "There are currently no active schedules assigned to your category."
                      : "Actualmente no hay horarios activos asignados a tu categoría."}
                </p>
                {canManageHorarios && (
                  <Button onClick={abrirNuevoHorario} className="mt-2 gap-2">
                    <Plus className="h-4 w-4" />
                    {isEnglish ? "Create First Schedule" : "Crear Primer Horario"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {DIAS_CATALOGO.map((diaInfo) => {
                const horariosDelDia = horariosPorDia[diaInfo.key] || [];
                if (horariosDelDia.length === 0) return null;

                return (
                  <Card
                    key={diaInfo.key}
                    className="border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-gray-800 dark:text-gray-200">
                            {isEnglish ? diaInfo.en : diaInfo.es}
                          </span>
                        </CardTitle>
                        <Badge className={diaInfo.badgeClass}>
                          {horariosDelDia.length}{" "}
                          {horariosDelDia.length === 1
                            ? getTranslation("commonMessages.class", isEnglish)
                            : getTranslation("commonMessages.classes", isEnglish)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {horariosDelDia.map((horario) => (
                          <div
                            key={horario.id}
                            className={`p-4 border dark:border-gray-700 rounded-lg transition-colors ${
                              horario.activo === false
                                ? "opacity-60 bg-muted/40"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                            }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                                {/* Horario */}
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      {getTranslation("commonMessages.schedule", isEnglish)}
                                    </p>
                                    <p className="font-medium">
                                      {(horario.hora_inicio || "").substring(0, 5)} -{" "}
                                      {(horario.hora_fin || "").substring(0, 5)}
                                    </p>
                                  </div>
                                </div>

                                {/* Categoría */}
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      {getTranslation("commonMessages.category", isEnglish).replace(":", "")}
                                    </p>
                                    <p className="font-medium">
                                      {horario.categoria_edad_nombre ||
                                        getTranslation("commonMessages.allLevels", isEnglish)}
                                    </p>
                                  </div>
                                </div>

                                {/* Instructor */}
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Instructor</p>
                                    <p className="font-medium">
                                      {horario.instructor || (isEnglish ? "To be assigned" : "Por asignar")}
                                    </p>
                                  </div>
                                </div>

                                {/* Capacidad */}
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      {getTranslation("commonMessages.capacity", isEnglish)}
                                    </p>
                                    <p className="font-medium">
                                      {horario.capacidad_maxima
                                        ? `${horario.capacidad_maxima} ${getTranslation("commonMessages.people", isEnglish)}`
                                        : isEnglish
                                          ? "Open"
                                          : "Sin límite"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {canManageHorarios && (
                                <div className="flex items-center gap-2 shrink-0">
                                  {horario.activo === false && (
                                    <Badge variant="secondary">
                                      {isEnglish ? "Inactive" : "Inactivo"}
                                    </Badge>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => abrirEditarHorario(horario)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    {isEnglish ? "Edit" : "Editar"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                    onClick={() => eliminarHorario(horario.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Días Festivos */}
          <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-orange-100/30 dark:from-orange-950/30 dark:to-orange-900/20">
            <CardHeader
              className="cursor-pointer"
              onClick={() => setDiasFestivosExpandidos(!diasFestivosExpandidos)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  <CardTitle className="text-orange-800 dark:text-orange-400">
                    {getTranslation("commonMessages.holidays", isEnglish)}
                  </CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {diasFestivos.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm">
                  {diasFestivosExpandidos ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <CardDescription className="dark:text-gray-300">
                {getTranslation("commonMessages.dojoClosed", isEnglish)}
              </CardDescription>
            </CardHeader>
            {diasFestivosExpandidos && (
              <CardContent>
                {diasFestivos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{getTranslation("commonMessages.noHolidaysRegistered", isEnglish)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diasFestivos.map((festivo) => (
                      <div
                        key={festivo.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                            <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="font-medium">{festivo.descripcion}</p>
                            <p className="text-sm text-muted-foreground">
                              {(() => {
                                const fecha = new Date(`${String(festivo.fecha).split("T")[0]}T12:00:00`);
                                if (isNaN(fecha.getTime())) {
                                  return festivo.fecha;
                                }
                                return fecha.toLocaleDateString(isEnglish ? "en-US" : "es-ES", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                });
                              })()}
                            </p>
                          </div>
                        </div>

                        {canManageHorarios && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirEditarFestivo(festivo)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => eliminarFestivo(festivo.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Información adicional */}
          <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100/30 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>{getTranslation("commonMessages.important", isEnglish)}</strong>{" "}
                    {getTranslation("commonMessages.arriveEarly", isEnglish)}
                  </p>
                  <p>{getTranslation("commonMessages.notifyInstructor", isEnglish)}</p>
                  <p>{getTranslation("commonMessages.contactDojo", isEnglish)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Crear/Editar Horario */}
      <Dialog open={horarioModalOpen} onOpenChange={setHorarioModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editandoHorario
                ? isEnglish
                  ? "Edit Class Schedule"
                  : "Editar Horario de Clase"
                : isEnglish
                  ? "New Class Schedule"
                  : "Nuevo Horario de Clase"}
            </DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Configure the day, hours, age category, and instructor."
                : "Configura el día, horario, categoría de edad e instructor asignado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isEnglish ? "Day of the Week *" : "Día de la Semana *"}</Label>
              <Select
                value={formHorario.dia_semana}
                onValueChange={(val) => setFormHorario({ ...formHorario, dia_semana: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_CATALOGO.map((d) => (
                    <SelectItem key={d.dbValue} value={d.dbValue}>
                      {isEnglish ? d.en : d.es}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Start Time *" : "Hora de Inicio *"}</Label>
                <Input
                  type="time"
                  value={formHorario.hora_inicio}
                  onChange={(e) => setFormHorario({ ...formHorario, hora_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "End Time *" : "Hora de Fin *"}</Label>
                <Input
                  type="time"
                  value={formHorario.hora_fin}
                  onChange={(e) => setFormHorario({ ...formHorario, hora_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Age Category" : "Categoría de Edad"}</Label>
                <Select
                  value={formHorario.id_categoria_edad}
                  onValueChange={(val) => setFormHorario({ ...formHorario, id_categoria_edad: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {isEnglish ? "All Categories" : "Todas las categorías"}
                    </SelectItem>
                    {categoriasEdad.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isEnglish ? "Instructor" : "Instructor"}</Label>
                <Select
                  value={formHorario.instructor_id}
                  onValueChange={(val) => setFormHorario({ ...formHorario, instructor_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {isEnglish ? "Unassigned" : "Sin asignar"}
                    </SelectItem>
                    {instructores.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.nombre_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Max Capacity" : "Capacidad Máxima"}</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={formHorario.capacidad_maxima}
                  onChange={(e) => setFormHorario({ ...formHorario, capacidad_maxima: e.target.value })}
                />
              </div>

              {editandoHorario && (
                <div className="space-y-2">
                  <Label>{isEnglish ? "Status" : "Estado"}</Label>
                  <Select
                    value={formHorario.activo ? "true" : "false"}
                    onValueChange={(val) => setFormHorario({ ...formHorario, activo: val === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{isEnglish ? "Active" : "Activo"}</SelectItem>
                      <SelectItem value="false">{isEnglish ? "Inactive" : "Inactivo"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHorarioModalOpen(false)}>
              {isEnglish ? "Cancel" : "Cancelar"}
            </Button>
            <Button onClick={guardarHorario} disabled={guardandoHorario}>
              {guardandoHorario
                ? isEnglish
                  ? "Saving..."
                  : "Guardando..."
                : isEnglish
                  ? "Save Schedule"
                  : "Guardar Horario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear/Editar Día Festivo */}
      <Dialog open={festivoModalOpen} onOpenChange={setFestivoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editandoFestivo
                ? isEnglish
                  ? "Edit Holiday"
                  : "Editar Día Festivo"
                : isEnglish
                  ? "Add Holiday"
                  : "Agregar Día Festivo"}
            </DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Specify the non-working date and its description."
                : "Indica la fecha no laborable y el motivo o celebración."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isEnglish ? "Date *" : "Fecha *"}</Label>
              <Input
                type="date"
                value={formFestivo.fecha}
                onChange={(e) => setFormFestivo({ ...formFestivo, fecha: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isEnglish ? "Description *" : "Descripción *"}</Label>
              <Input
                value={formFestivo.descripcion}
                onChange={(e) => setFormFestivo({ ...formFestivo, descripcion: e.target.value })}
                placeholder={isEnglish ? "Ex: National Holiday" : "Ej: Día de la Independencia"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFestivoModalOpen(false)}>
              {isEnglish ? "Cancel" : "Cancelar"}
            </Button>
            <Button onClick={guardarFestivo} disabled={guardandoFestivo}>
              {guardandoFestivo
                ? isEnglish
                  ? "Saving..."
                  : "Guardando..."
                : isEnglish
                  ? "Save Holiday"
                  : "Guardar Festivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
