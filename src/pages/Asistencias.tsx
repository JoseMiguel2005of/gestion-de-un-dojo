import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck2,
  Users,
  AlertTriangle,
  Save,
} from "lucide-react";

type EstadoAsistencia = "presente" | "tardanza" | "justificado" | "ausente";

interface RegistroBorrador {
  estado: EstadoAsistencia;
  observaciones: string;
}

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function Asistencias() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isStaff = ["admin", "instructor", "asistente", "recepcionista"].includes(user?.rol || "");

  const hoyISO = new Date().toISOString().split("T")[0];
  const fechaActual = new Date();

  // Estados para Pasar Lista (Staff)
  const [horarios, setHorarios] = useState<any[]>([]);
  const [fechaSesion, setFechaSesion] = useState<string>(hoyISO);
  const [horarioId, setHorarioId] = useState<string>("");
  const [sesionData, setSesionData] = useState<any>(null);
  const [borrador, setBorrador] = useState<Record<number, RegistroBorrador>>({});
  const [cargandoSesion, setCargandoSesion] = useState(false);
  const [guardandoLote, setGuardandoLote] = useState(false);

  // Estados para Resumen e Historial
  const [mesFiltro, setMesFiltro] = useState<string>(String(fechaActual.getMonth() + 1));
  const [anioFiltro, setAnioFiltro] = useState<string>(String(fechaActual.getFullYear()));
  const [resumen, setResumen] = useState<{
    estadisticas: {
      total: number;
      presentes: number;
      tardanzas: number;
      justificados: number;
      ausentes: number;
      porcentajeAsistencia: number;
    };
    porAlumno: any[];
    historialReciente: any[];
  }>({
    estadisticas: {
      total: 0,
      presentes: 0,
      tardanzas: 0,
      justificados: 0,
      ausentes: 0,
      porcentajeAsistencia: 0,
    },
    porAlumno: [],
    historialReciente: [],
  });
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    if (isStaff) {
      cargarHorarios();
    }
  }, [isStaff]);

  useEffect(() => {
    cargarResumen();
  }, [mesFiltro, anioFiltro]);

  useEffect(() => {
    if (isStaff && fechaSesion && horarioId) {
      cargarSesionAsistencia(fechaSesion, horarioId);
    }
  }, [isStaff, fechaSesion, horarioId]);

  const cargarHorarios = async () => {
    try {
      const lista = await apiClient.getHorarios();
      const activos = (lista || []).filter((h: any) => h.activo !== false);
      setHorarios(activos);
      if (activos.length > 0 && !horarioId) {
        setHorarioId(String(activos[0].id));
      }
    } catch (error) {
      console.error("Error cargando horarios para asistencia:", error);
    }
  };

  const cargarSesionAsistencia = async (fecha: string, idHor: string) => {
    setCargandoSesion(true);
    try {
      const data = await apiClient.getSesionAsistencia(fecha, idHor);
      setSesionData(data);
      const nuevoBorrador: Record<number, RegistroBorrador> = {};
      (data.alumnos || []).forEach((al: any) => {
        nuevoBorrador[al.id_alumno] = {
          estado: (al.estado as EstadoAsistencia) || "presente",
          observaciones: al.observaciones || "",
        };
      });
      setBorrador(nuevoBorrador);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEnglish ? "Could not load attendance session" : "No se pudo cargar la sesión de asistencia"),
        variant: "destructive",
      });
    } finally {
      setCargandoSesion(false);
    }
  };

  const cargarResumen = async () => {
    setCargandoResumen(true);
    try {
      const params: { mes?: number; anio?: number } = {};
      if (mesFiltro !== "all") params.mes = Number(mesFiltro);
      if (anioFiltro) params.anio = Number(anioFiltro);
      const data = await apiClient.getResumenAsistencia(params);
      setResumen(data);
    } catch (error) {
      console.error("Error cargando resumen de asistencia:", error);
    } finally {
      setCargandoResumen(false);
    }
  };

  const marcarTodos = (estado: EstadoAsistencia) => {
    if (!sesionData?.alumnos) return;
    const copia: Record<number, RegistroBorrador> = {};
    sesionData.alumnos.forEach((al: any) => {
      copia[al.id_alumno] = {
        estado,
        observaciones: borrador[al.id_alumno]?.observaciones || "",
      };
    });
    setBorrador(copia);
  };

  const guardarPaseDeLista = async () => {
    if (!fechaSesion || !horarioId || !sesionData?.alumnos?.length) return;
    setGuardandoLote(true);
    try {
      const registros = sesionData.alumnos.map((al: any) => ({
        id_alumno: Number(al.id_alumno),
        estado: borrador[al.id_alumno]?.estado || "presente",
        observaciones: borrador[al.id_alumno]?.observaciones?.trim() || null,
      }));

      const resp = await apiClient.registrarAsistenciaLote({
        fecha: fechaSesion,
        id_horario: Number(horarioId),
        registros,
      });

      toast({
        title: isEnglish ? "Attendance saved" : "Asistencia registrada",
        description: isEnglish
          ? `${resp.total_guardados} student records saved`
          : `Se guardó la asistencia de ${resp.total_guardados} alumno(s)`,
      });

      cargarSesionAsistencia(fechaSesion, horarioId);
      cargarResumen();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuardandoLote(false);
    }
  };

  const renderEstadoBadge = (estado: string) => {
    switch (estado) {
      case "presente":
        return (
          <Badge className="bg-green-600 text-white gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isEnglish ? "Present" : "Presente"}
          </Badge>
        );
      case "tardanza":
        return (
          <Badge className="bg-amber-500 text-white gap-1">
            <Clock className="h-3.5 w-3.5" />
            {isEnglish ? "Late" : "Tardanza"}
          </Badge>
        );
      case "justificado":
        return (
          <Badge className="bg-blue-600 text-white gap-1">
            <FileCheck2 className="h-3.5 w-3.5" />
            {isEnglish ? "Excused" : "Justificado"}
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3.5 w-3.5" />
            {isEnglish ? "Absent" : "Ausente"}
          </Badge>
        );
    }
  };

  const renderResumenSection = () => (
    <div className="space-y-6">
      {/* Filtros de periodo */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>{isEnglish ? "Month" : "Mes"}</Label>
              <Select value={mesFiltro} onValueChange={setMesFiltro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isEnglish ? "Full Year" : "Todo el año"}</SelectItem>
                  {(isEnglish ? MESES_EN : MESES_ES).map((nombreMes, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {nombreMes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Year" : "Año"}</Label>
              <Input
                type="number"
                min={2020}
                max={2099}
                value={anioFiltro}
                onChange={(e) => setAnioFiltro(e.target.value)}
              />
            </div>

            <Button variant="outline" onClick={cargarResumen}>
              {isEnglish ? "Refresh Metrics" : "Actualizar Métricas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isEnglish ? "Attendance Rate" : "% Asistencia"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {resumen.estadisticas.porcentajeAsistencia}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isEnglish ? "Present" : "Presentes"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {resumen.estadisticas.presentes}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isEnglish ? "Late" : "Tardanzas"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {resumen.estadisticas.tardanzas}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isEnglish ? "Excused" : "Justificados"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {resumen.estadisticas.justificados}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isEnglish ? "Absent" : "Ausentes"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {resumen.estadisticas.ausentes}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por alumno (útil para Staff y para alumno con varios representados) */}
      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isEnglish ? "Attendance by Student" : "Porcentaje de Asistencia por Alumno"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargandoResumen ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {isEnglish ? "Loading..." : "Cargando resumen..."}
              </p>
            ) : resumen.porAlumno.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {isEnglish
                  ? "No attendance records for the selected period."
                  : "No hay asistencias registradas en el período seleccionado."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEnglish ? "Student" : "Alumno"}</TableHead>
                      <TableHead className="text-center">{isEnglish ? "Present" : "Presentes"}</TableHead>
                      <TableHead className="text-center">{isEnglish ? "Late" : "Tardanzas"}</TableHead>
                      <TableHead className="text-center">{isEnglish ? "Excused" : "Justificados"}</TableHead>
                      <TableHead className="text-center">{isEnglish ? "Absent" : "Ausentes"}</TableHead>
                      <TableHead className="text-right">{isEnglish ? "Rate" : "% Asistencia"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.porAlumno.map((al) => (
                      <TableRow key={al.id_alumno}>
                        <TableCell className="font-medium">
                          <div>{al.nombre}</div>
                          {al.cedula && <span className="text-xs text-muted-foreground">{al.cedula}</span>}
                        </TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{al.presentes}</TableCell>
                        <TableCell className="text-center text-amber-600 font-medium">{al.tardanzas}</TableCell>
                        <TableCell className="text-center text-blue-600 font-medium">{al.justificados}</TableCell>
                        <TableCell className="text-center text-destructive font-medium">{al.ausentes}</TableCell>
                        <TableCell className="text-right font-bold">{al.porcentajeAsistencia}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial cronológico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isEnglish ? "Recent Attendance History" : "Historial Reciente de Clases"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoResumen ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {isEnglish ? "Loading..." : "Cargando historial..."}
            </p>
          ) : resumen.historialReciente.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {isEnglish ? "No records found." : "No se encontraron registros de asistencia."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEnglish ? "Date" : "Fecha"}</TableHead>
                    {isStaff && <TableHead>{isEnglish ? "Student" : "Alumno"}</TableHead>}
                    <TableHead>{isEnglish ? "Class" : "Horario"}</TableHead>
                    <TableHead>{isEnglish ? "Status" : "Estado"}</TableHead>
                    <TableHead>{isEnglish ? "Notes" : "Observaciones"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.historialReciente.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {new Date(`${String(item.fecha).split("T")[0]}T12:00:00`).toLocaleDateString(
                          isEnglish ? "en-US" : "es-ES"
                        )}
                      </TableCell>
                      {isStaff && <TableCell>{item.alumno_nombre}</TableCell>}
                      <TableCell className="text-sm text-muted-foreground">
                        {item.dia_semana || ""}{" "}
                        {item.hora_inicio ? `(${String(item.hora_inicio).substring(0, 5)})` : ""}
                      </TableCell>
                      <TableCell>{renderEstadoBadge(item.estado)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.observaciones || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <CalendarCheck className="h-8 w-8 text-primary" />
          <span>{isEnglish ? "Class Attendance" : "Control de Asistencia"}</span>
        </h2>
        <p className="text-muted-foreground mt-1">
          {isStaff
            ? isEnglish
              ? "Take daily class attendance and track student regularity"
              : "Registra la asistencia por clase y supervisa la constancia de los alumnos"
            : isEnglish
              ? "Track your class attendance record and regularity percentage"
              : "Consulta tu porcentaje de asistencia e historial de clases en el dojo"}
        </p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="pasar-lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pasar-lista">
              {isEnglish ? "Take Attendance" : "Pasar Lista"}
            </TabsTrigger>
            <TabsTrigger value="resumen">
              {isEnglish ? "Monthly Summary" : "Resumen e Historial"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pasar-lista" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {isEnglish ? "Select Class Session" : "Seleccionar Sesión de Clase"}
                </CardTitle>
                <CardDescription>
                  {isEnglish
                    ? "Choose the date and class schedule to record attendance."
                    : "Elige la fecha y el horario de clase para cargar los alumnos correspondientes."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isEnglish ? "Class Date" : "Fecha de la Clase"}</Label>
                    <Input
                      type="date"
                      value={fechaSesion}
                      onChange={(e) => setFechaSesion(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{isEnglish ? "Schedule" : "Horario de Clase"}</Label>
                    <Select value={horarioId} onValueChange={setHorarioId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            horarios.length === 0
                              ? isEnglish
                                ? "No active schedules"
                                : "No hay horarios activos"
                              : isEnglish
                                ? "Select schedule..."
                                : "Seleccionar horario..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {horarios.map((h) => (
                          <SelectItem key={h.id} value={String(h.id)}>
                            {h.dia_semana} ({String(h.hora_inicio).substring(0, 5)} -{" "}
                            {String(h.hora_fin).substring(0, 5)}) -{" "}
                            {h.categoria_edad_nombre || (isEnglish ? "All Levels" : "Todas las categorías")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {sesionData?.es_dia_festivo && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>
                      <strong>{isEnglish ? "Holiday Warning:" : "Día festivo registrado:"}</strong>{" "}
                      {sesionData.festivo_descripcion}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {cargandoSesion ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  {isEnglish ? "Loading students..." : "Cargando alumnos de la clase..."}
                </CardContent>
              </Card>
            ) : sesionData && sesionData.alumnos ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {isEnglish ? "Student Roll Call" : "Listado de Alumnos"} ({sesionData.alumnos.length})
                      </CardTitle>
                      <CardDescription>
                        {sesionData.horario?.categoria_nombre ||
                          (isEnglish ? "All Categories" : "Todas las categorías")}{" "}
                        {sesionData.horario?.instructor ? `• Sensei: ${sesionData.horario.instructor}` : ""}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => marcarTodos("presente")}
                      >
                        {isEnglish ? "Mark All Present" : "Marcar Todos Presentes"}
                      </Button>
                      <Button
                        type="button"
                        onClick={guardarPaseDeLista}
                        disabled={guardandoLote || sesionData.alumnos.length === 0}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {guardandoLote
                          ? isEnglish
                            ? "Saving..."
                            : "Guardando..."
                          : isEnglish
                            ? "Save Attendance"
                            : "Guardar Asistencia"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sesionData.alumnos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {isEnglish
                        ? "No active students belong to this schedule's category."
                        : "No hay alumnos activos pertenecientes a la categoría de este horario."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sesionData.alumnos.map((al: any) => {
                        const actual = borrador[al.id_alumno] || {
                          estado: "presente",
                          observaciones: "",
                        };
                        return (
                          <div
                            key={al.id_alumno}
                            className="p-3 rounded-lg border bg-card flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                          >
                            <div className="min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{al.nombre}</span>
                                {al.registrado && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {isEnglish ? "Saved" : "Guardado"}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {al.cedula} {al.cinta_nombre ? `• 🥋 ${al.cinta_nombre}` : ""}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {(
                                [
                                  { id: "presente", es: "Presente", en: "Present", activeClass: "bg-green-600 hover:bg-green-700 text-white" },
                                  { id: "tardanza", es: "Tardanza", en: "Late", activeClass: "bg-amber-500 hover:bg-amber-600 text-white" },
                                  { id: "justificado", es: "Justificado", en: "Excused", activeClass: "bg-blue-600 hover:bg-blue-700 text-white" },
                                  { id: "ausente", es: "Ausente", en: "Absent", activeClass: "bg-red-600 hover:bg-red-700 text-white" },
                                ] as const
                              ).map((op) => {
                                const seleccionado = actual.estado === op.id;
                                return (
                                  <Button
                                    key={op.id}
                                    type="button"
                                    size="sm"
                                    variant={seleccionado ? "default" : "outline"}
                                    className={seleccionado ? op.activeClass : ""}
                                    onClick={() =>
                                      setBorrador({
                                        ...borrador,
                                        [al.id_alumno]: {
                                          ...actual,
                                          estado: op.id,
                                        },
                                      })
                                    }
                                  >
                                    {isEnglish ? op.en : op.es}
                                  </Button>
                                );
                              })}
                            </div>

                            <div className="w-full lg:w-64">
                              <Input
                                placeholder={isEnglish ? "Optional note..." : "Observación opcional..."}
                                value={actual.observaciones}
                                onChange={(e) =>
                                  setBorrador({
                                    ...borrador,
                                    [al.id_alumno]: {
                                      ...actual,
                                      observaciones: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="resumen">{renderResumenSection()}</TabsContent>
        </Tabs>
      ) : (
        renderResumenSection()
      )}
    </div>
  );
}
