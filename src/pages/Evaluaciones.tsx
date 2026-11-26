import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  ClipboardCheck,
  Trash2,
  Eye,
  Award,
  ChevronDown,
  ChevronUp,
  Edit,
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EvaluacionForm } from "@/components/forms/EvaluacionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { calculateExamTimeInfo } from "@/utils/timeUtils";
import { useLanguage, getTranslation, translateBelt } from "@/hooks/useLanguage";

interface DraftCalificacion {
  aprobado: "true" | "false" | "pending";
  notas: string;
}

export default function Evaluaciones() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isAdmin = user?.rol === "admin";
  const canCreateEvaluation = ["admin", "instructor", "asistente"].includes(user?.rol || "");

  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verDialogOpen, setVerDialogOpen] = useState(false);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState<any>(null);
  const [resultadosEvaluacion, setResultadosEvaluacion] = useState<any[]>([]);
  const [cargandoResultados, setCargandoResultados] = useState(false);
  const [miAlumno, setMiAlumno] = useState<any>(null);
  const [listaMinimizada, setListaMinimizada] = useState(false);

  // Edición de evaluación
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [instructores, setInstructores] = useState<any[]>([]);
  const [alumnosActivos, setAlumnosActivos] = useState<any[]>([]);
  const [alumnoExtraId, setAlumnoExtraId] = useState<string>("");
  const [inscribiendoAlumno, setInscribiendoAlumno] = useState(false);

  const [editForm, setEditForm] = useState({
    id: "",
    nombre: "",
    fecha: "",
    hora: "",
    instructor_id: "none",
    estado: "pendiente",
    descripcion: "",
  });

  // Calificaciones y promoción automática
  const [borradorCalificaciones, setBorradorCalificaciones] = useState<Record<number, DraftCalificacion>>({});
  const [completarAlGuardar, setCompletarAlGuardar] = useState(true);
  const [guardandoCalificaciones, setGuardandoCalificaciones] = useState(false);
  const [evaluacionEliminarId, setEvaluacionEliminarId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvaluaciones();
    if (user?.rol === "usuario") {
      fetchMiAlumno();
    } else if (canCreateEvaluation) {
      fetchCatalogosStaff();
    }
  }, [user, canCreateEvaluation]);

  const fetchCatalogosStaff = async () => {
    try {
      const [senseisData, alumnosData] = await Promise.all([
        apiClient.getSenseisDisponibles().catch(() => []),
        apiClient.getAlumnos().catch(() => []),
      ]);
      setInstructores(senseisData || []);
      setAlumnosActivos((alumnosData || []).filter((a: any) => Boolean(a.estado)));
    } catch (err) {
      console.error("Error cargando catálogos de evaluaciones:", err);
    }
  };

  const fetchEvaluaciones = async () => {
    try {
      const data = await apiClient.getEvaluaciones();
      setEvaluaciones(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load evaluations" : "No se pudieron cargar las evaluaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMiAlumno = async () => {
    try {
      const alumnos = await apiClient.getAlumnos();
      const encontrado = alumnos.find((alumno: any) => String(alumno.usuario_id) === String(user?.id));
      setMiAlumno(encontrado || null);
    } catch (error: any) {
      console.error("Error cargando información del alumno:", error);
    }
  };

  const handleDelete = (evaluacionId: string) => {
    setEvaluacionEliminarId(String(evaluacionId));
  };

  const ejecutarEliminarEvaluacion = async () => {
    if (!evaluacionEliminarId) return;
    const id = evaluacionEliminarId;
    setEvaluacionEliminarId(null);

    try {
      await apiClient.delete(`/evaluaciones/${id}`);
      toast({
        title: isEnglish ? "Evaluation deleted" : "Evaluación eliminada",
        description: isEnglish ? "Evaluation deleted successfully" : "La evaluación se eliminó correctamente",
      });
      fetchEvaluaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Could not delete evaluation" : "No se pudo eliminar la evaluación"),
        variant: "destructive",
      });
    }
  };

  const abrirEditarEvaluacion = (ev: any) => {
    setEditForm({
      id: String(ev.id),
      nombre: ev.nombre || "",
      fecha: ev.fecha ? String(ev.fecha).split("T")[0] : "",
      hora: ev.hora ? String(ev.hora).substring(0, 5) : "",
      instructor_id: ev.instructor_id ? String(ev.instructor_id) : "none",
      estado: ev.estado || "pendiente",
      descripcion: ev.descripcion || "",
    });
    setEditDialogOpen(true);
  };

  const guardarEdicionEvaluacion = async () => {
    if (!editForm.nombre.trim() || !editForm.fecha) {
      toast({
        title: isEnglish ? "Missing fields" : "Campos requeridos",
        description: isEnglish ? "Name and date are required" : "El nombre y la fecha son obligatorios",
        variant: "destructive",
      });
      return;
    }

    setGuardandoEdicion(true);
    try {
      await apiClient.updateEvaluacion(editForm.id, {
        nombre: editForm.nombre.trim(),
        fecha: editForm.fecha,
        hora: editForm.hora || null,
        instructor_id: editForm.instructor_id !== "none" ? Number(editForm.instructor_id) : null,
        estado: editForm.estado,
        descripcion: editForm.descripcion.trim() || null,
      });

      toast({
        title: isEnglish ? "Evaluation updated" : "Evaluación actualizada",
        description: isEnglish ? "Changes saved successfully" : "Los cambios se guardaron correctamente",
      });
      setEditDialogOpen(false);
      fetchEvaluaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const inicializarBorradorResultados = (lista: any[], estadoActual?: string) => {
    const mapa: Record<number, DraftCalificacion> = {};
    lista.forEach((r) => {
      mapa[r.id_alumno] = {
        aprobado: r.aprobado === true ? "true" : r.aprobado === false ? "false" : "pending",
        notas: r.notas || "",
      };
    });
    setBorradorCalificaciones(mapa);
    setCompletarAlGuardar(estadoActual !== "completada");
  };

  const handleVerEvaluacion = async (evaluacion: any) => {
    setEvaluacionSeleccionada(evaluacion);
    setVerDialogOpen(true);
    setCargandoResultados(true);
    setResultadosEvaluacion([]);
    setAlumnoExtraId("");

    try {
      const resultados = await apiClient.getEvaluacionResultados(String(evaluacion.id));
      const arr = Array.isArray(resultados) ? resultados : [];
      setResultadosEvaluacion(arr);
      inicializarBorradorResultados(arr, evaluacion.estado);
    } catch (error: any) {
      console.error("Error cargando resultados:", error);
    } finally {
      setCargandoResultados(false);
    }
  };

  const handleInscribirAlumnoExtra = async () => {
    if (!evaluacionSeleccionada || !alumnoExtraId) return;
    setInscribiendoAlumno(true);
    try {
      await apiClient.createEvaluacionResultado(String(evaluacionSeleccionada.id), {
        id_alumno: Number(alumnoExtraId),
      });
      toast({
        title: isEnglish ? "Student added" : "Alumno inscrito",
        description: isEnglish ? "Student added to evaluation" : "El alumno fue inscrito en el examen",
      });
      setAlumnoExtraId("");
      const resultados = await apiClient.getEvaluacionResultados(String(evaluacionSeleccionada.id));
      const arr = Array.isArray(resultados) ? resultados : [];
      setResultadosEvaluacion(arr);
      inicializarBorradorResultados(arr, evaluacionSeleccionada.estado);
      fetchEvaluaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInscribiendoAlumno(false);
    }
  };

  const guardarCalificacionesYPromover = async () => {
    if (!evaluacionSeleccionada) return;
    const calificaciones = resultadosEvaluacion.map((r) => {
      const draft = borradorCalificaciones[r.id_alumno];
      return {
        id_alumno: Number(r.id_alumno),
        aprobado:
          draft?.aprobado === "true" ? true : draft?.aprobado === "false" ? false : null,
        notas: draft?.notas?.trim() || null,
      };
    });

    setGuardandoCalificaciones(true);
    try {
      const resp = await apiClient.calificarEvaluacion(evaluacionSeleccionada.id, {
        calificaciones,
        completar_evaluacion: completarAlGuardar,
      });

      toast({
        title: isEnglish ? "Grades saved" : "Calificaciones guardadas",
        description: isEnglish
          ? `${resp.calificados} evaluated • ${resp.promovidos} belt promotion(s)`
          : `${resp.calificados} evaluado(s) • ${resp.promovidos} ascenso(s) automático(s) de cinta`,
      });

      const actualizados = await apiClient.getEvaluacionResultados(String(evaluacionSeleccionada.id));
      const arr = Array.isArray(actualizados) ? actualizados : [];
      setResultadosEvaluacion(arr);
      setEvaluacionSeleccionada({
        ...evaluacionSeleccionada,
        estado: resp.estado || evaluacionSeleccionada.estado,
      });
      inicializarBorradorResultados(arr, resp.estado);
      fetchEvaluaciones();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardandoCalificaciones(false);
    }
  };

  const idsYaInscritos = new Set(resultadosEvaluacion.map((r) => Number(r.id_alumno)));
  const alumnosDisponiblesInscribir = alumnosActivos.filter((a) => !idsYaInscritos.has(Number(a.id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">
            {canCreateEvaluation ? (isEnglish ? "Evaluation " : "Gestión ") : isEnglish ? "My " : "Mis "}
            <span className="text-orange-600 dark:text-orange-400">
              {canCreateEvaluation
                ? isEnglish
                  ? "Management"
                  : "de Evaluaciones"
                : isEnglish
                  ? "Evaluations"
                  : "Evaluaciones"}
            </span>
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {canCreateEvaluation
              ? isEnglish
                ? "Schedule exams, grade students, and manage belt promotions"
                : "Programa exámenes, registra calificaciones y gestiona ascensos de cinta"
              : isEnglish
                ? "Check your scheduled exams and official belt promotions"
                : "Consulta tus exámenes programados y resultados de ascenso"}
          </p>
        </div>
        {canCreateEvaluation && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="h-4 w-4" />
                {isEnglish ? "Create Evaluation" : "Crear Evaluación"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{isEnglish ? "Create New Evaluation" : "Crear Nueva Evaluación"}</DialogTitle>
                <DialogDescription>
                  {isEnglish
                    ? "Select the exam type and eligible students."
                    : "Selecciona el tipo de examen y los alumnos elegibles."}
                </DialogDescription>
              </DialogHeader>
              <EvaluacionForm
                onSuccess={() => {
                  setDialogOpen(false);
                  fetchEvaluaciones();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Indicador de preparación para usuarios alumnos */}
      {user?.rol === "usuario" && miAlumno && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-indigo-950/30 dark:to-indigo-900/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-3 rounded-2xl">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-indigo-700 dark:text-indigo-400">
                  {getTranslation("commonMessages.yourFirstExam", isEnglish)}
                </CardTitle>
                <CardDescription className="text-indigo-600 dark:text-indigo-300">
                  {getTranslation("commonMessages.timeRemaining", isEnglish)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const examInfo = calculateExamTimeInfo(miAlumno, isEnglish);
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{examInfo.icon}</span>
                    <div>
                      <p className={`text-lg font-semibold ${examInfo.color}`}>{examInfo.mensaje}</p>
                      {examInfo.proximoExamenFecha && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {getTranslation("commonMessages.estimatedDate", isEnglish)}{" "}
                          {new Date(examInfo.proximoExamenFecha).toLocaleDateString(
                            isEnglish ? "en-US" : "es-ES",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {examInfo.tiempoPreparacionMeses && examInfo.proximoExamenFecha && (
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {getTranslation("commonMessages.preparationProgress", isEnglish)}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {examInfo.tiempoPreparacionMeses} {getTranslation("commonMessages.months", isEnglish)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: (() => {
                              const fechaInicio = new Date(miAlumno.fecha_inscripcion || miAlumno.created_at);
                              const fechaExamen = new Date(examInfo.proximoExamenFecha);
                              const hoy = new Date();

                              const diasTotales = Math.max(
                                1,
                                Math.ceil((fechaExamen.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24))
                              );
                              const diasTranscurridos = Math.ceil(
                                (hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)
                              );

                              const progreso = Math.max(0, Math.min(100, (diasTranscurridos / diasTotales) * 100));
                              return `${progreso}%`;
                            })(),
                          }}
                        />
                      </div>
                      {examInfo.categoria && examInfo.cinta && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          {getTranslation("commonMessages.categoryBelt", isEnglish)} {examInfo.categoria} |{" "}
                          {getTranslation("commonMessages.beltColon", isEnglish)}{" "}
                          {translateBelt(examInfo.cinta, isEnglish)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Tabla principal de evaluaciones */}
      <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/60 to-orange-100/20 dark:from-orange-950/30 dark:to-orange-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <CardTitle className="text-orange-700 dark:text-orange-400">
                {isEnglish ? "Evaluation List" : "Lista de Evaluaciones"}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setListaMinimizada(!listaMinimizada)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950/20"
            >
              {listaMinimizada ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  {getTranslation("commonMessages.expand", isEnglish)}
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  {getTranslation("commonMessages.collapse", isEnglish)}
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            {evaluaciones.length} {getTranslation("commonMessages.evaluationRegistered", isEnglish)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!listaMinimizada && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-orange-200 dark:border-orange-800">
                    <TableHead>{isEnglish ? "Name" : "Nombre"}</TableHead>
                    <TableHead>{isEnglish ? "Date" : "Fecha"}</TableHead>
                    <TableHead>{isEnglish ? "Time" : "Hora"}</TableHead>
                    <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                    <TableHead>{isEnglish ? "Instructor" : "Instructor"}</TableHead>
                    <TableHead>{isEnglish ? "Status" : "Estado"}</TableHead>
                    <TableHead>{isEnglish ? "Actions" : "Acciones"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "Loading..." : "Cargando..."}
                      </TableCell>
                    </TableRow>
                  ) : evaluaciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isEnglish ? "No evaluations registered" : "No hay evaluaciones registradas"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    evaluaciones.map((evaluacion) => {
                      const completada =
                        evaluacion.estado === "completada" || evaluacion.estado === "completado";
                      return (
                        <TableRow
                          key={evaluacion.id}
                          className="border-orange-100 dark:border-orange-900 hover:bg-orange-50/30 dark:hover:bg-orange-950/20"
                        >
                          <TableCell className="font-medium">
                            <div>{evaluacion.nombre}</div>
                            {typeof evaluacion.total_inscritos === "number" && (
                              <span className="text-xs text-muted-foreground">
                                {evaluacion.total_inscritos}{" "}
                                {isEnglish ? "enrolled" : "inscrito(s)"}
                                {evaluacion.total_aprobados > 0
                                  ? ` • ${evaluacion.total_aprobados} ${isEnglish ? "promoted" : "aprobado(s)"}`
                                  : ""}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(
                              new Date(`${String(evaluacion.fecha).split("T")[0]}T12:00:00`),
                              isEnglish ? "MM/dd/yyyy" : "dd/MM/yyyy",
                              { locale: isEnglish ? undefined : es }
                            )}
                          </TableCell>
                          <TableCell>
                            {evaluacion.hora ? (
                              <Badge variant="secondary">
                                🕐 {String(evaluacion.hora).substring(0, 5)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {getTranslation("commonMessages.noTime", isEnglish)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {evaluacion.categoria_examen ||
                              getTranslation("commonMessages.allCategories", isEnglish)}
                          </TableCell>
                          <TableCell>
                            {evaluacion.instructor_nombre || (
                              <span className="text-xs text-muted-foreground">
                                {isEnglish ? "Unassigned" : "Sin asignar"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={completada ? "default" : "outline"}
                              className={
                                completada
                                  ? "bg-green-600 text-white"
                                  : "border-amber-500 text-amber-700 dark:text-amber-400"
                              }
                            >
                              {completada
                                ? isEnglish
                                  ? "Completed"
                                  : "Completada"
                                : isEnglish
                                  ? "Pending"
                                  : "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerEvaluacion(evaluacion)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {canCreateEvaluation
                                  ? isEnglish
                                    ? "Grade / View"
                                    : "Calificar / Ver"
                                  : isEnglish
                                    ? "View"
                                    : "Ver"}
                              </Button>
                              {canCreateEvaluation && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirEditarEvaluacion(evaluacion)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(evaluacion.id)}
                                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para Editar Evaluación */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Edit Evaluation" : "Editar Evaluación"}</DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Modify exam details, assigned instructor, or status."
                : "Modifica los datos del examen, el instructor evaluador o su estado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isEnglish ? "Exam Name *" : "Nombre de la Evaluación *"}</Label>
              <Input
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Date *" : "Fecha *"}</Label>
                <Input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Time" : "Hora"}</Label>
                <Input
                  type="time"
                  value={editForm.hora}
                  onChange={(e) => setEditForm({ ...editForm, hora: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Evaluator Instructor" : "Instructor Evaluador"}</Label>
                <Select
                  value={editForm.instructor_id}
                  onValueChange={(val) => setEditForm({ ...editForm, instructor_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isEnglish ? "Unassigned" : "Sin asignar"}</SelectItem>
                    {instructores.map((inst) => (
                      <SelectItem key={inst.id} value={String(inst.id)}>
                        {inst.nombre_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isEnglish ? "Status" : "Estado"}</Label>
                <Select
                  value={editForm.estado}
                  onValueChange={(val) => setEditForm({ ...editForm, estado: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">{isEnglish ? "Pending" : "Pendiente"}</SelectItem>
                    <SelectItem value="completada">{isEnglish ? "Completed" : "Completada"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Description / Notes" : "Descripción / Observaciones"}</Label>
              <Textarea
                rows={3}
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {isEnglish ? "Cancel" : "Cancelar"}
            </Button>
            <Button onClick={guardarEdicionEvaluacion} disabled={guardandoEdicion}>
              {guardandoEdicion
                ? isEnglish
                  ? "Saving..."
                  : "Guardando..."
                : isEnglish
                  ? "Save Changes"
                  : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Ver Detalles, Calificar y Promover Alumnos */}
      <Dialog open={verDialogOpen} onOpenChange={setVerDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {canCreateEvaluation
                ? isEnglish
                  ? "Evaluation Details & Grading"
                  : "Detalles, Calificación y Ascensos de Cinta"
                : isEnglish
                  ? "Evaluation Details"
                  : "Detalles de la Evaluación"}
            </DialogTitle>
            <DialogDescription>
              {canCreateEvaluation
                ? isEnglish
                  ? "Approving a student automatically promotes them to the next belt according to their age category."
                  : "Al marcar a un alumno como Aprobado y guardar, el sistema promueve automáticamente su cinta y actualiza su próximo ciclo de preparación."
                : isEnglish
                  ? "Official results of your evaluation"
                  : "Información y resultados oficiales de la evaluación"}
            </DialogDescription>
          </DialogHeader>

          {evaluacionSeleccionada && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/40 border">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {getTranslation("commonMessages.name", isEnglish)}
                  </span>
                  <span className="text-sm font-semibold">{evaluacionSeleccionada.nombre}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {getTranslation("commonMessages.date", isEnglish)}
                  </span>
                  <span className="text-sm font-medium">
                    {format(
                      new Date(`${String(evaluacionSeleccionada.fecha).split("T")[0]}T12:00:00`),
                      isEnglish ? "MM/dd/yyyy" : "dd/MM/yyyy",
                      { locale: isEnglish ? undefined : es }
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {getTranslation("commonMessages.time", isEnglish)}
                  </span>
                  <span className="text-sm font-medium">
                    {evaluacionSeleccionada.hora
                      ? String(evaluacionSeleccionada.hora).substring(0, 5)
                      : getTranslation("commonMessages.notSpecified", isEnglish)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {getTranslation("commonMessages.status", isEnglish)}
                  </span>
                  <Badge
                    variant={
                      evaluacionSeleccionada.estado === "completada" ||
                      evaluacionSeleccionada.estado === "completado"
                        ? "default"
                        : "outline"
                    }
                    className={
                      evaluacionSeleccionada.estado === "completada" ||
                      evaluacionSeleccionada.estado === "completado"
                        ? "bg-green-600 text-white mt-0.5"
                        : "mt-0.5"
                    }
                  >
                    {evaluacionSeleccionada.estado === "completada" ||
                    evaluacionSeleccionada.estado === "completado"
                      ? isEnglish
                        ? "Completed"
                        : "Completada"
                      : isEnglish
                        ? "Pending"
                        : "Pendiente"}
                  </Badge>
                </div>
              </div>

              {evaluacionSeleccionada.descripcion && (
                <div className="p-3 rounded-md bg-muted/30 border text-sm">
                  <strong className="block text-xs text-muted-foreground mb-1">
                    {isEnglish ? "Description:" : "Descripción:"}
                  </strong>
                  {evaluacionSeleccionada.descripcion}
                </div>
              )}

              {/* Inscribir alumno adicional si es staff */}
              {canCreateEvaluation && alumnosDisponiblesInscribir.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 p-3 rounded-lg border bg-background">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">
                      {isEnglish ? "Enroll additional student" : "Inscribir alumno adicional al examen"}
                    </Label>
                    <Select value={alumnoExtraId} onValueChange={setAlumnoExtraId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isEnglish ? "Select active student..." : "Seleccionar alumno activo..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {alumnosDisponiblesInscribir.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.nombre} ({a.cedula}) - {a.cinta_nombre || "Sin cinta"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!alumnoExtraId || inscribiendoAlumno}
                    onClick={handleInscribirAlumnoExtra}
                    className="gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    {isEnglish ? "Add Student" : "Inscribir"}
                  </Button>
                </div>
              )}

              {/* Lista de inscritos y calificaciones */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">
                  {isEnglish ? "Enrolled Students & Results" : "Alumnos Inscritos y Calificaciones"} (
                  {resultadosEvaluacion.length})
                </h4>

                {cargandoResultados ? (
                  <p className="text-sm text-muted-foreground py-4">
                    {isEnglish ? "Loading enrolled students..." : "Cargando alumnos inscritos..."}
                  </p>
                ) : resultadosEvaluacion.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-sm text-muted-foreground">
                    {isEnglish
                      ? "No students enrolled in this evaluation yet."
                      : "Aún no hay alumnos inscritos en esta evaluación."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resultadosEvaluacion.map((resultado: any) => {
                      const draft = borradorCalificaciones[resultado.id_alumno] || {
                        aprobado: "pending",
                        notas: "",
                      };

                      return (
                        <div
                          key={resultado.id}
                          className="p-4 rounded-lg border bg-card space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold">{resultado.alumno_nombre}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {resultado.alumno_cedula && <span>ID: {resultado.alumno_cedula}</span>}
                                {resultado.cinta_anterior_nombre && (
                                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                    🥋 {resultado.cinta_anterior_nombre}
                                    {resultado.cinta_nueva_nombre && (
                                      <>
                                        <ArrowRight className="h-3 w-3 text-green-600" />
                                        <Badge className="bg-green-600 text-white text-[11px] py-0">
                                          {resultado.cinta_nueva_nombre}
                                        </Badge>
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Estado visual para alumnos o resumen rápido */}
                            {!canCreateEvaluation && (
                              <div>
                                {resultado.aprobado === true ? (
                                  <Badge className="bg-green-600 text-white gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {isEnglish ? "Approved" : "Aprobado"}
                                  </Badge>
                                ) : resultado.aprobado === false ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3.5 w-3.5" />
                                    {isEnglish ? "Not Passed" : "Reprobado"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    {isEnglish ? "Pending Grade" : "Pendiente por calificar"}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {canCreateEvaluation && (
                              <div className="w-full sm:w-48">
                                <Select
                                  value={draft.aprobado}
                                  onValueChange={(val: "true" | "false" | "pending") =>
                                    setBorradorCalificaciones({
                                      ...borradorCalificaciones,
                                      [resultado.id_alumno]: {
                                        ...draft,
                                        aprobado: val,
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">
                                      {isEnglish ? "Pending" : "Sin calificar"}
                                    </SelectItem>
                                    <SelectItem value="true">
                                      {isEnglish ? "✅ Approved (Promote)" : "✅ Aprobado (Promover)"}
                                    </SelectItem>
                                    <SelectItem value="false">
                                      {isEnglish ? "❌ Not Passed" : "❌ Reprobado"}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {canCreateEvaluation ? (
                            <div>
                              <Input
                                placeholder={
                                  isEnglish
                                    ? "Technical observations or score..."
                                    : "Observaciones técnicas, puntaje o recomendaciones..."
                                }
                                value={draft.notas}
                                onChange={(e) =>
                                  setBorradorCalificaciones({
                                    ...borradorCalificaciones,
                                    [resultado.id_alumno]: {
                                      ...draft,
                                      notas: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          ) : (
                            resultado.notas && (
                              <p className="text-sm text-muted-foreground italic border-l-2 pl-3">
                                "{resultado.notas}"
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {canCreateEvaluation && resultadosEvaluacion.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completarAlGuardar}
                      onChange={(e) => setCompletarAlGuardar(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>
                      {isEnglish
                        ? "Mark evaluation as Completed upon saving"
                        : "Marcar evaluación como Completada al guardar"}
                    </span>
                  </label>

                  <Button
                    onClick={guardarCalificacionesYPromover}
                    disabled={guardandoCalificaciones}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {guardandoCalificaciones
                      ? isEnglish
                        ? "Saving..."
                        : "Guardando..."
                      : isEnglish
                        ? "Save Grades & Promote Approved"
                        : "Guardar Calificaciones y Promover"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(evaluacionEliminarId)}
        onOpenChange={(open) => {
          if (!open) setEvaluacionEliminarId(null);
        }}
        title={isEnglish ? "Delete Evaluation" : "Eliminar Evaluación"}
        description={
          isEnglish
            ? "Are you sure you want to delete this evaluation? Evaluations with graded results cannot be deleted."
            : "¿Estás seguro de eliminar esta evaluación? Las evaluaciones que ya tienen resultados calificados están protegidas."
        }
        confirmText={isEnglish ? "Delete" : "Eliminar"}
        cancelText={isEnglish ? "Cancel" : "Cancelar"}
        onConfirm={ejecutarEliminarEvaluacion}
      />
    </div>
  );
}
