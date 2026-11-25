import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Check,
  Plus,
  Search,
  AlertTriangle,
  Eye,
  Building2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VerificacionPagoForm } from "@/components/forms/VerificacionPagoForm";
import { useLanguage, translateBelt } from "@/hooks/useLanguage";

interface ConfigPagos {
  dia_corte?: number;
  descuento_pago_adelantado?: number;
  costo_inscripcion?: number;
  metodos_pago?: string | string[];
  datos_bancarios?: string;
  moneda?: string;
  pais_configuracion?: string;
  tipo_cambio_usd_bs?: number;
}

interface Pago {
  id: number;
  id_alumno: number;
  mes: number;
  anio: number;
  monto: number;
  moneda?: string;
  tasa_cambio?: number;
  metodo_pago: string;
  fecha_pago: string;
  mes_correspondiente: string;
  estado: "pendiente" | "confirmado" | "rechazado" | string;
  referencia?: string;
  banco_origen?: string;
  cedula_titular?: string;
  telefono_cuenta?: string;
  comprobante?: string;
  observaciones?: string;
  motivo_rechazo?: string;
  created_at: string;
  alumno_nombre?: string;
  alumno_cedula?: string;
  registrado_por_nombre?: string;
  verificado_por_nombre?: string;
  fecha_verificacion?: string;
}

export default function Pagos() {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const isUsuarioNormal = user?.rol === "usuario";
  const canVerifyPayments = user?.rol === "admin" || user?.rol === "recepcionista";

  const [configPagos, setConfigPagos] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [totalPagos, setTotalPagos] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [pendientesMes, setPendientesMes] = useState<any[]>([]);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [precioAlumno, setPrecioAlumno] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiadoBanco, setCopiadoBanco] = useState(false);

  // Filtros administrativos
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  // Modales
  const [dialogPagoAlumno, setDialogPagoAlumno] = useState(false);
  const [dialogDetalles, setDialogDetalles] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<Pago | null>(null);

  // Modal rechazo
  const [dialogRechazo, setDialogRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Modal registro manual (admin/recepcionista)
  const [dialogPagoManual, setDialogPagoManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    id_alumno: "",
    monto: "",
    metodo_pago: "Efectivo",
    fecha_pago: new Date().toISOString().split("T")[0],
    mes: String(new Date().getMonth() + 1),
    anio: String(new Date().getFullYear()),
    referencia: "",
    observaciones: "",
  });

  const tasaCambio = Number(configPagos?.tipo_cambio_usd_bs) > 0 ? Number(configPagos?.tipo_cambio_usd_bs) : 220;
  const esMonedaBs = configPagos?.moneda === "BS.";

  const formatPrimaryCurrency = (usdAmount: number | string | undefined | null) => {
    const usd = Number(usdAmount) || 0;
    if (esMonedaBs) {
      return `Bs. ${(usd * tasaCambio).toLocaleString("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `USD$ ${usd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatSecondaryEquivalent = (usdAmount: number | string | undefined | null) => {
    const usd = Number(usdAmount) || 0;
    if (esMonedaBs) {
      return `USD$ ${usd.toFixed(2)}`;
    }
    return `Bs. ${(usd * tasaCambio).toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const cfg = await apiClient.getConfigPagos();
      setConfigPagos(cfg);

      if (isUsuarioNormal) {
        const [alumnosData, pagosResp] = await Promise.all([
          apiClient.getAlumnos(),
          apiClient.getPagosPaginados({ page, limit: pageSize }),
        ]);
        setAlumnos(alumnosData || []);
        setPagos(pagosResp.items || []);
        setTotalPagos(pagosResp.total || 0);

        if (alumnosData && alumnosData.length > 0) {
          const precio = await apiClient.getPrecioAlumno(String(alumnosData[0].id)).catch(() => null);
          setPrecioAlumno(precio);
        }
      } else {
        const [pagosResp, morososResp, alumnosActivos] = await Promise.all([
          apiClient.getPagosPaginados({
            page,
            limit: pageSize,
            estado: filtroEstado !== "todos" ? filtroEstado : undefined,
            mes: filtroMes !== "todos" ? parseInt(filtroMes, 10) : undefined,
          }),
          apiClient.getPagosPendientes(),
          apiClient.getAlumnos(),
        ]);
        setPagos(pagosResp.items || []);
        setTotalPagos(pagosResp.total || 0);
        setPendientesMes(morososResp || []);
        setAlumnos(alumnosActivos || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: isEnglish ? "Could not load payment data" : "No se pudieron cargar los datos de pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, filtroEstado, filtroMes, isUsuarioNormal]);

  const pagosPorVerificar = useMemo(
    () => pagos.filter((p) => p.estado === "pendiente"),
    [pagos]
  );

  const pagosFiltradosBusqueda = useMemo(() => {
    if (!filtroBusqueda.trim()) return pagos;
    const q = filtroBusqueda.toLowerCase();
    return pagos.filter(
      (p) =>
        (p.alumno_nombre || "").toLowerCase().includes(q) ||
        (p.alumno_cedula || "").toLowerCase().includes(q) ||
        (p.referencia || "").toLowerCase().includes(q)
    );
  }, [pagos, filtroBusqueda]);

  const handleCopyBanco = async () => {
    if (!configPagos?.datos_bancarios) return;
    await navigator.clipboard.writeText(configPagos.datos_bancarios);
    setCopiadoBanco(true);
    setTimeout(() => setCopiadoBanco(false), 2000);
  };

  const handleConfirmarPago = async (pago: Pago) => {
    setProcesandoAccion(true);
    try {
      await apiClient.confirmarPago(pago.id);
      toast({
        title: isEnglish ? "Payment confirmed" : "Pago confirmado",
        description: `${pago.alumno_nombre || ""} — ${formatPrimaryCurrency(pago.monto)}`,
      });
      setDialogDetalles(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirModalRechazo = (pago: Pago) => {
    setPagoSeleccionado(pago);
    setMotivoRechazo("");
    setDialogRechazo(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!pagoSeleccionado || !motivoRechazo.trim()) {
      toast({
        title: "Error",
        description: isEnglish ? "Rejection reason is required" : "Debes indicar el motivo del rechazo",
        variant: "destructive",
      });
      return;
    }
    setProcesandoAccion(true);
    try {
      await apiClient.rechazarPago(pagoSeleccionado.id, motivoRechazo.trim());
      toast({
        title: isEnglish ? "Payment rejected" : "Pago rechazado",
        description: isEnglish ? "The student will see the rejection reason" : "El motivo quedó visible para el alumno",
      });
      setDialogRechazo(false);
      setDialogDetalles(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirPagoManualParaAlumno = async (alumnoId?: number) => {
    const idStr = alumnoId ? String(alumnoId) : "";
    let montoSugerido = "";
    if (alumnoId) {
      const p = await apiClient.getPrecioAlumno(String(alumnoId)).catch(() => null);
      if (p?.precio_final !== undefined) {
        montoSugerido = String(p.precio_final);
      }
    }
    setManualForm({
      id_alumno: idStr,
      monto: montoSugerido,
      metodo_pago: "Efectivo",
      fecha_pago: new Date().toISOString().split("T")[0],
      mes: String(new Date().getMonth() + 1),
      anio: String(new Date().getFullYear()),
      referencia: "",
      observaciones: "",
    });
    setDialogPagoManual(true);
  };

  const handleSelectAlumnoManual = async (alumnoIdStr: string) => {
    setManualForm((prev) => ({ ...prev, id_alumno: alumnoIdStr }));
    const p = await apiClient.getPrecioAlumno(alumnoIdStr).catch(() => null);
    if (p?.precio_final !== undefined) {
      setManualForm((prev) => ({ ...prev, monto: String(p.precio_final) }));
    }
  };

  const handleSubmitPagoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.id_alumno || !manualForm.monto) {
      toast({
        title: "Error",
        description: isEnglish ? "Select student and amount" : "Seleccione alumno y monto",
        variant: "destructive",
      });
      return;
    }
    setProcesandoAccion(true);
    try {
      const mesNum = parseInt(manualForm.mes, 10);
      const anioNum = parseInt(manualForm.anio, 10);
      const mesTexto = new Date(anioNum, mesNum - 1, 1).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });

      await apiClient.createPago({
        id_alumno: parseInt(manualForm.id_alumno, 10),
        monto: parseFloat(manualForm.monto),
        metodo_pago: manualForm.metodo_pago,
        fecha_pago: manualForm.fecha_pago,
        mes: mesNum,
        anio: anioNum,
        mes_correspondiente: mesTexto,
        referencia: manualForm.referencia || null,
        observaciones: manualForm.observaciones || "Registrado en recepción",
        estado: "confirmado",
      });

      toast({
        title: isEnglish ? "Payment registered" : "Pago registrado y confirmado",
      });
      setDialogPagoManual(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.data?.error || error.message,
        variant: "destructive",
      });
    } finally {
      setProcesandoAccion(false);
    }
  };

  const renderEstadoBadge = (estado: string) => {
    if (estado === "confirmado") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
          <CheckCircle className="h-3 w-3" />
          {isEnglish ? "Confirmed" : "Confirmado"}
        </Badge>
      );
    }
    if (estado === "rechazado") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {isEnglish ? "Rejected" : "Rechazado"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
        <Clock className="h-3 w-3" />
        {isEnglish ? "Pending Review" : "Pendiente"}
      </Badge>
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalPagos / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            {isEnglish ? "Payments & Monthly Billing" : "Pagos y Mensualidades"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isUsuarioNormal
              ? isEnglish
                ? "Bank details, payment submission, and verification status"
                : "Datos bancarios del dojo, envío de comprobantes y estado de tus mensualidades"
              : isEnglish
              ? "Verify transfers, register manual payments, and track monthly delinquency"
              : "Verificación de transferencias, cobros en recepción y control de solvencia mensual"}
          </p>
        </div>

        {canVerifyPayments && (
          <Button onClick={() => abrirPagoManualParaAlumno()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" />
            {isEnglish ? "Register Manual Payment" : "Registrar Pago Manual"}
          </Button>
        )}
      </div>

      {/* VISTA ALUMNO / USUARIO NORMAL */}
      {isUsuarioNormal ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{isEnglish ? "Your Monthly Fee" : "Tu Mensualidad"}</CardTitle>
                    <CardDescription>
                      {precioAlumno?.categoria_nombre
                        ? `${precioAlumno.categoria_nombre}${
                            precioAlumno.cinta_alumno ? ` • ${translateBelt(precioAlumno.cinta_alumno, isEnglish)}` : ""
                          }`
                        : isEnglish
                        ? "Complete enrollment first"
                        : "Completa tu inscripción para calcular tu tarifa"}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPrimaryCurrency(precioAlumno?.precio_final || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isEnglish ? "Equivalent:" : "Equivalente:"} {formatSecondaryEquivalent(precioAlumno?.precio_final || 0)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {precioAlumno?.es_alumno_nuevo && (
                  <div className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 p-3 rounded-lg border border-blue-200 dark:border-blue-800 space-y-1">
                    <p className="font-semibold">
                      {isEnglish ? "First Payment Breakdown:" : "Desglose de primer pago:"}
                    </p>
                    <p>• {isEnglish ? "Monthly fee:" : "Mensualidad:"} {formatPrimaryCurrency(precioAlumno.precio_base)}</p>
                    <p>• {isEnglish ? "Registration fee:" : "Inscripción:"} {formatPrimaryCurrency(precioAlumno.costo_inscripcion)}</p>
                  </div>
                )}

                {precioAlumno?.descuento_porcentaje > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ {isEnglish ? "Scholarship / Discount applied:" : "Beca / Descuento aplicado:"} {precioAlumno.descuento_porcentaje}%
                  </p>
                )}

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!alumnos.length}
                  onClick={() => setDialogPagoAlumno(true)}
                >
                  {isEnglish ? "Report Transfer / Mobile Payment" : "Reportar Pago (Transferencia / Pago Móvil)"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    {isEnglish ? "Official Bank Accounts" : "Cuentas Oficiales del Dojo"}
                  </CardTitle>
                </div>
                {configPagos?.datos_bancarios && (
                  <Button variant="outline" size="sm" onClick={handleCopyBanco} className="gap-1.5">
                    {copiadoBanco ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copiadoBanco ? (isEnglish ? "Copied" : "Copiado") : isEnglish ? "Copy" : "Copiar"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {configPagos?.datos_bancarios ? (
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-lg border text-foreground">
                    {configPagos.datos_bancarios}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    {isEnglish
                      ? "Bank account information has not been published yet. Contact reception."
                      : "La administración aún no ha publicado los datos bancarios. Consulta en recepción."}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "Exchange rate:" : "Tasa referencial:"} 1 USD = Bs. {tasaCambio.toFixed(2)} •{" "}
                  {isEnglish ? "Cutoff day:" : "Día de corte:"} {configPagos?.dia_corte || 5}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isEnglish ? "Your Payment History" : "Tu Historial de Pagos"}</CardTitle>
              <CardDescription>
                {totalPagos} {isEnglish ? "record(s)" : "pago(s) registrado(s)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">{isEnglish ? "Loading..." : "Cargando..."}</p>
              ) : pagos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {isEnglish ? "You have no payments registered yet." : "Aún no tienes pagos registrados."}
                </p>
              ) : (
                pagos.map((pago) => (
                  <div
                    key={pago.id}
                    onClick={() => {
                      setPagoSeleccionado(pago);
                      setDialogDetalles(true);
                    }}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground capitalize">{pago.mes_correspondiente}</p>
                        <p className="text-xs text-muted-foreground">
                          {pago.metodo_pago} {pago.referencia ? `• Ref: ${pago.referencia}` : ""} •{" "}
                          {new Date(pago.fecha_pago).toLocaleDateString(isEnglish ? "en-US" : "es-ES")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-foreground">{formatPrimaryCurrency(pago.monto)}</p>
                          <p className="text-xs text-muted-foreground">{formatSecondaryEquivalent(pago.monto)}</p>
                        </div>
                        {renderEstadoBadge(pago.estado)}
                      </div>
                    </div>
                    {pago.estado === "rechazado" && pago.motivo_rechazo && (
                      <div className="text-xs bg-destructive/10 text-destructive p-2.5 rounded border border-destructive/30">
                        <strong>{isEnglish ? "Rejection reason:" : "Motivo de rechazo:"}</strong> {pago.motivo_rechazo}
                      </div>
                    )}
                  </div>
                ))
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {isEnglish ? "Previous" : "Anterior"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {isEnglish ? `Page ${page} of ${totalPages}` : `Página ${page} de ${totalPages}`}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    {isEnglish ? "Next" : "Siguiente"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* VISTA PERSONAL ADMINISTRATIVO / RECEPCIÓN / INSTRUCTOR */
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{isEnglish ? "Pending Verification" : "Pagos por Verificar"}</CardDescription>
                <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">
                  {pagosPorVerificar.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "Transfers awaiting staff review" : "Comprobantes esperando validación"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{isEnglish ? "Unpaid Students (Current Month)" : "Alumnos sin Confirmar este Mes"}</CardDescription>
                <CardTitle className="text-3xl text-rose-600 dark:text-rose-400">
                  {pendientesMes.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "Active students without confirmed payment" : "Alumnos activos pendientes del mes actual"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{isEnglish ? "Exchange Rate & Currency" : "Moneda y Tasa Activa"}</CardDescription>
                <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
                  {configPagos?.moneda || "USD$"} • Bs. {tasaCambio.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isEnglish ? "Cutoff day:" : "Día de corte mensual:"} {configPagos?.dia_corte || 5}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="historial" className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-2">
              <TabsTrigger value="historial">
                {isEnglish ? "Payments & Verification" : "Pagos y Verificación"} ({totalPagos})
              </TabsTrigger>
              <TabsTrigger value="morosidad">
                {isEnglish ? "Pending Students" : "Pendientes del Mes"} ({pendientesMes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historial" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <CardTitle>{isEnglish ? "Payment Registry" : "Registro y Bandeja de Verificación"}</CardTitle>
                      <CardDescription>
                        {isEnglish
                          ? "Filter by status or month, inspect receipts, and confirm or reject transfers"
                          : "Filtra por estado o mes, revisa referencias/comprobantes y confirma o rechaza pagos"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative w-56">
                        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                          placeholder={isEnglish ? "Student or reference..." : "Alumno o referencia..."}
                          value={filtroBusqueda}
                          onChange={(e) => setFiltroBusqueda(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Select
                        value={filtroEstado}
                        onValueChange={(v) => {
                          setPage(1);
                          setFiltroEstado(v);
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">{isEnglish ? "All statuses" : "Todos los estados"}</SelectItem>
                          <SelectItem value="pendiente">{isEnglish ? "Pending Review" : "Pendientes"}</SelectItem>
                          <SelectItem value="confirmado">{isEnglish ? "Confirmed" : "Confirmados"}</SelectItem>
                          <SelectItem value="rechazado">{isEnglish ? "Rejected" : "Rechazados"}</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={filtroMes}
                        onValueChange={(v) => {
                          setPage(1);
                          setFiltroMes(v);
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">{isEnglish ? "All months" : "Todos los meses"}</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {new Date(2025, m - 1, 1).toLocaleDateString(isEnglish ? "en-US" : "es-ES", {
                                month: "long",
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isEnglish ? "Student" : "Alumno"}</TableHead>
                        <TableHead>{isEnglish ? "Period" : "Período"}</TableHead>
                        <TableHead>{isEnglish ? "Method / Ref" : "Método / Ref."}</TableHead>
                        <TableHead>{isEnglish ? "Amount" : "Monto"}</TableHead>
                        <TableHead>{isEnglish ? "Status" : "Estado"}</TableHead>
                        <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {isEnglish ? "Loading..." : "Cargando..."}
                          </TableCell>
                        </TableRow>
                      ) : pagosFiltradosBusqueda.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {isEnglish ? "No payments match the selected filters" : "No hay pagos para los filtros seleccionados"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagosFiltradosBusqueda.map((pago) => (
                          <TableRow key={pago.id}>
                            <TableCell>
                              <div className="font-medium">{pago.alumno_nombre || `#${pago.id_alumno}`}</div>
                              {pago.alumno_cedula && (
                                <div className="text-xs text-muted-foreground font-mono">{pago.alumno_cedula}</div>
                              )}
                            </TableCell>
                            <TableCell className="capitalize">
                              <div>{pago.mes_correspondiente || `${pago.mes}/${pago.anio}`}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(pago.fecha_pago).toLocaleDateString(isEnglish ? "en-US" : "es-ES")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{pago.metodo_pago}</div>
                              {pago.referencia && (
                                <div className="text-xs font-mono text-muted-foreground">Ref: {pago.referencia}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatPrimaryCurrency(pago.monto)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatSecondaryEquivalent(pago.monto)}
                              </div>
                            </TableCell>
                            <TableCell>{renderEstadoBadge(pago.estado)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPagoSeleccionado(pago);
                                    setDialogDetalles(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canVerifyPayments && pago.estado === "pendiente" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      disabled={procesandoAccion}
                                      onClick={() => handleConfirmarPago(pago)}
                                    >
                                      {isEnglish ? "Confirm" : "Confirmar"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={procesandoAccion}
                                      onClick={() => abrirModalRechazo(pago)}
                                    >
                                      {isEnglish ? "Reject" : "Rechazar"}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        {isEnglish ? "Previous" : "Anterior"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {isEnglish ? `Page ${page} of ${totalPages}` : `Página ${page} de ${totalPages}`}
                      </span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        {isEnglish ? "Next" : "Siguiente"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="morosidad" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {isEnglish ? "Students Without Confirmed Payment This Month" : "Alumnos sin Pago Confirmado en el Mes Actual"}
                  </CardTitle>
                  <CardDescription>
                    {isEnglish
                      ? "Active students who have not yet confirmed their monthly payment"
                      : "Lista en vivo para seguimiento administrativo y cobro directo en recepción"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isEnglish ? "ID" : "Cédula"}</TableHead>
                        <TableHead>{isEnglish ? "Student" : "Alumno"}</TableHead>
                        <TableHead>{isEnglish ? "Category" : "Categoría"}</TableHead>
                        <TableHead>{isEnglish ? "Estimated Fee" : "Mensualidad"}</TableHead>
                        <TableHead>{isEnglish ? "Status" : "Situación"}</TableHead>
                        {canVerifyPayments && <TableHead className="text-right">{isEnglish ? "Action" : "Acción"}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendientesMes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-emerald-600 font-medium">
                            🎉 {isEnglish ? "All active students are up to date this month!" : "¡Todos los alumnos activos están solventes este mes!"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendientesMes.map((al) => (
                          <TableRow key={al.id}>
                            <TableCell className="font-mono text-xs">{al.cedula}</TableCell>
                            <TableCell>
                              <div className="font-medium">{al.nombre}</div>
                              {al.telefono && <div className="text-xs text-muted-foreground">{al.telefono}</div>}
                            </TableCell>
                            <TableCell>{al.categoria_nombre || "-"}</TableCell>
                            <TableCell className="font-semibold">{formatPrimaryCurrency(al.monto_mensual)}</TableCell>
                            <TableCell>
                              {al.en_revision ? (
                                <Badge className="bg-amber-600 text-white">
                                  {isEnglish ? "Receipt in Review" : "Comprobante en revisión"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-rose-600 border-rose-300">
                                  {isEnglish ? "Unpaid" : "Sin pago"}
                                </Badge>
                              )}
                            </TableCell>
                            {canVerifyPayments && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={al.en_revision}
                                  onClick={() => abrirPagoManualParaAlumno(al.id)}
                                >
                                  {isEnglish ? "Collect" : "Cobrar"}
                                </Button>
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
        </>
      )}

      {/* MODAL REPORTE DE PAGO (ALUMNO) */}
      <Dialog open={dialogPagoAlumno} onOpenChange={setDialogPagoAlumno}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Report Payment" : "Reportar Pago"}</DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Submit your bank transfer or mobile payment details for verification"
                : "Registra los datos de tu transferencia o pago móvil para validación"}
            </DialogDescription>
          </DialogHeader>
          <VerificacionPagoForm
            montoPagar={Number(precioAlumno?.precio_final || 50)}
            moneda={configPagos?.moneda}
            alumnoId={alumnos[0]?.id}
            onSuccess={() => {
              setDialogPagoAlumno(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLES DEL PAGO */}
      <Dialog open={dialogDetalles} onOpenChange={setDialogDetalles}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Payment Details" : "Detalle del Pago"}</DialogTitle>
            <DialogDescription>
              {pagoSeleccionado?.alumno_nombre ? `${pagoSeleccionado.alumno_nombre} • ` : ""}
              {pagoSeleccionado?.mes_correspondiente}
            </DialogDescription>
          </DialogHeader>
          {pagoSeleccionado && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg border bg-muted/40">
                <div>
                  <span className="text-muted-foreground block text-xs">{isEnglish ? "Amount" : "Monto"}</span>
                  <span className="font-bold text-base">{formatPrimaryCurrency(pagoSeleccionado.monto)}</span>
                  <span className="text-xs text-muted-foreground block">{formatSecondaryEquivalent(pagoSeleccionado.monto)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">{isEnglish ? "Status" : "Estado"}</span>
                  <div className="mt-1">{renderEstadoBadge(pagoSeleccionado.estado)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">{isEnglish ? "Method" : "Método"}</span>
                  <span className="font-medium">{pagoSeleccionado.metodo_pago}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">{isEnglish ? "Payment Date" : "Fecha de Pago"}</span>
                  <span className="font-medium">
                    {new Date(pagoSeleccionado.fecha_pago).toLocaleDateString(isEnglish ? "en-US" : "es-ES")}
                  </span>
                </div>
                {pagoSeleccionado.referencia && (
                  <div>
                    <span className="text-muted-foreground block text-xs">{isEnglish ? "Reference" : "Referencia"}</span>
                    <span className="font-mono font-semibold">{pagoSeleccionado.referencia}</span>
                  </div>
                )}
                {pagoSeleccionado.banco_origen && (
                  <div>
                    <span className="text-muted-foreground block text-xs">{isEnglish ? "Origin Bank" : "Banco Origen"}</span>
                    <span>{pagoSeleccionado.banco_origen}</span>
                  </div>
                )}
                {pagoSeleccionado.cedula_titular && (
                  <div>
                    <span className="text-muted-foreground block text-xs">{isEnglish ? "Holder ID" : "Cédula Titular"}</span>
                    <span className="font-mono">{pagoSeleccionado.cedula_titular}</span>
                  </div>
                )}
                {pagoSeleccionado.telefono_cuenta && (
                  <div>
                    <span className="text-muted-foreground block text-xs">{isEnglish ? "Account Phone" : "Teléfono"}</span>
                    <span className="font-mono">{pagoSeleccionado.telefono_cuenta}</span>
                  </div>
                )}
              </div>

              {pagoSeleccionado.motivo_rechazo && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
                  <strong>{isEnglish ? "Rejection reason:" : "Motivo de rechazo:"}</strong> {pagoSeleccionado.motivo_rechazo}
                </div>
              )}

              {pagoSeleccionado.observaciones && (
                <div className="p-3 border rounded-lg">
                  <span className="text-xs text-muted-foreground block">{isEnglish ? "Notes" : "Observaciones"}</span>
                  <p>{pagoSeleccionado.observaciones}</p>
                </div>
              )}

              {pagoSeleccionado.comprobante && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    {isEnglish ? "Attached Receipt:" : "Comprobante Adjunto:"}
                  </span>
                  {pagoSeleccionado.comprobante.startsWith("data:image") ||
                  pagoSeleccionado.comprobante.startsWith("http") ? (
                    <img
                      src={pagoSeleccionado.comprobante}
                      alt="Comprobante de pago"
                      className="max-h-80 rounded-lg border object-contain mx-auto"
                    />
                  ) : (
                    <p className="font-mono text-xs break-all p-2 bg-muted rounded">{pagoSeleccionado.comprobante}</p>
                  )}
                </div>
              )}

              {canVerifyPayments && pagoSeleccionado.estado === "pendiente" && (
                <DialogFooter className="gap-2 pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => abrirModalRechazo(pagoSeleccionado)}
                    disabled={procesandoAccion}
                  >
                    {isEnglish ? "Reject Payment" : "Rechazar Pago"}
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleConfirmarPago(pagoSeleccionado)}
                    disabled={procesandoAccion}
                  >
                    {isEnglish ? "Confirm Payment" : "Confirmar Pago"}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL RECHAZAR PAGO */}
      <Dialog open={dialogRechazo} onOpenChange={setDialogRechazo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Reject Payment" : "Rechazar Pago"}</DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Explain why this payment could not be verified so the student can submit a corrected receipt."
                : "Indica el motivo del rechazo (ej: referencia no encontrada, monto incompleto). El alumno podrá enviar un nuevo comprobante."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{isEnglish ? "Reason *" : "Motivo del Rechazo *"}</Label>
            <Textarea
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder={isEnglish ? "Reference number not found in bank statement..." : "Ej: Número de referencia no coincide en estado de cuenta..."}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRechazo(false)}>
              {isEnglish ? "Cancel" : "Cancelar"}
            </Button>
            <Button variant="destructive" onClick={handleConfirmarRechazo} disabled={procesandoAccion}>
              {isEnglish ? "Confirm Rejection" : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PAGO MANUAL (ADMIN / RECEPCIONISTA) */}
      <Dialog open={dialogPagoManual} onOpenChange={setDialogPagoManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Register Manual Payment" : "Registrar Pago en Recepción"}</DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Record a verified cash, transfer, or POS payment directly for a student."
                : "Registra un pago en efectivo, punto de venta o transferencia ya verificada."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPagoManual} className="space-y-4">
            <div className="space-y-2">
              <Label>{isEnglish ? "Student *" : "Alumno *"}</Label>
              <Select value={manualForm.id_alumno} onValueChange={handleSelectAlumnoManual}>
                <SelectTrigger>
                  <SelectValue placeholder={isEnglish ? "Select student..." : "Seleccionar alumno..."} />
                </SelectTrigger>
                <SelectContent>
                  {alumnos.map((al) => (
                    <SelectItem key={al.id} value={String(al.id)}>
                      {al.nombre} ({al.cedula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Month *" : "Mes *"}</Label>
                <Select
                  value={manualForm.mes}
                  onValueChange={(v) => setManualForm({ ...manualForm, mes: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2025, m - 1, 1).toLocaleDateString(isEnglish ? "en-US" : "es-ES", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Year *" : "Año *"}</Label>
                <Input
                  type="number"
                  min="2020"
                  max="2035"
                  value={manualForm.anio}
                  onChange={(e) => setManualForm({ ...manualForm, anio: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Amount (USD$) *" : "Monto (USD$) *"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={manualForm.monto}
                  onChange={(e) => setManualForm({ ...manualForm, monto: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Method *" : "Método *"}</Label>
                <Select
                  value={manualForm.metodo_pago}
                  onValueChange={(v) => setManualForm({ ...manualForm, metodo_pago: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">{isEnglish ? "Cash" : "Efectivo"}</SelectItem>
                    <SelectItem value="Punto de Venta">{isEnglish ? "POS Card" : "Punto de Venta"}</SelectItem>
                    <SelectItem value="Pago Móvil">Pago Móvil</SelectItem>
                    <SelectItem value="Transferencia">{isEnglish ? "Transfer" : "Transferencia"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEnglish ? "Date *" : "Fecha *"}</Label>
                <Input
                  type="date"
                  value={manualForm.fecha_pago}
                  onChange={(e) => setManualForm({ ...manualForm, fecha_pago: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{isEnglish ? "Reference (Optional)" : "Referencia (Opcional)"}</Label>
                <Input
                  value={manualForm.referencia}
                  onChange={(e) => setManualForm({ ...manualForm, referencia: e.target.value })}
                  placeholder="Ej: Recibo #0042"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Notes" : "Observaciones"}</Label>
              <Input
                value={manualForm.observaciones}
                onChange={(e) => setManualForm({ ...manualForm, observaciones: e.target.value })}
                placeholder={isEnglish ? "Optional note..." : "Nota opcional..."}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogPagoManual(false)}>
                {isEnglish ? "Cancel" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={procesandoAccion} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {procesandoAccion
                  ? isEnglish
                    ? "Saving..."
                    : "Guardando..."
                  : isEnglish
                  ? "Save & Confirm"
                  : "Guardar y Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
