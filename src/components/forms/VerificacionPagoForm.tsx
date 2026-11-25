import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, Upload, Clock } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const BANCOS_VENEZUELA = [
  "Banco de Venezuela",
  "Banesco",
  "Banco Mercantil",
  "Banco Provincial (BBVA)",
  "Bancamiga",
  "Banco Bicentenario",
  "Bancaribe",
  "Banco Exterior",
  "Banco Activo",
  "Banco Nacional de Crédito (BNC)",
  "Mi Banco",
  "Banco del Tesoro",
  "Banco Sofitasa",
  "Bangente",
  "Banco Plaza",
  "Banco Caroní",
  "Banco Fondo Común",
  "100% Banco",
  "Banplus",
  "Banco Venezolano de Crédito",
];

const BANCOS_ESTADOS_UNIDOS = [
  "Bank of America",
  "Wells Fargo",
  "JPMorgan Chase",
  "Citibank",
  "U.S. Bank",
  "PNC Bank",
  "Capital One",
  "TD Bank",
  "HSBC Bank USA",
  "Regions Bank",
  "Fifth Third Bank",
  "KeyBank",
  "PNC / Zelle",
  "Citizens Bank",
];

function getLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type VerificacionPagoFormData = {
  banco_origen: string;
  referencia: string;
  cedula_titular: string;
  telefono_cuenta: string;
  fecha_transferencia: string;
  monto: string;
  metodo_pago: "transferencia" | "pago_movil";
};

interface VerificacionPagoFormProps {
  montoPagar: number;
  onSuccess: () => void;
  moneda?: string;
  alumnoId?: number;
}

export function VerificacionPagoForm({ montoPagar, onSuccess, alumnoId }: VerificacionPagoFormProps) {
  const { isEnglish } = useLanguage();
  const [paisConfiguracion, setPaisConfiguracion] = useState<string>("venezuela");
  const [datosBancarios, setDatosBancarios] = useState<string>("");
  const [tasaCambio, setTasaCambio] = useState<number>(220);
  const [monedaSistema, setMonedaSistema] = useState<string>("USD$");
  const [copiado, setCopiado] = useState(false);

  const [loading, setLoading] = useState(false);
  const [esPagoAdelantado, setEsPagoAdelantado] = useState(false);
  const [montoConDescuento, setMontoConDescuento] = useState(montoPagar);
  const [descuentoInfo, setDescuentoInfo] = useState<{
    porcentaje: number;
    precioOriginal: number;
    precioFinal: number;
  } | null>(null);
  const [comprobanteDataUrl, setComprobanteDataUrl] = useState<string | null>(null);
  const [comprobanteNombre, setComprobanteNombre] = useState<string>("");

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);
  const minDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateStr(d);
  }, []);

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const config = await apiClient.getConfigPagos();
        setPaisConfiguracion(config.pais_configuracion || "venezuela");
        setDatosBancarios(config.datos_bancarios || "");
        setTasaCambio(Number(config.tipo_cambio_usd_bs) || 220);
        setMonedaSistema(config.moneda || "USD$");
      } catch (error) {
        console.error("Error cargando configuración de pagos:", error);
      }
    };
    cargarConfig();
  }, []);

  const validationSchema = useMemo(() => {
    return z.object({
      metodo_pago: z.enum(["transferencia", "pago_movil"], {
        required_error: isEnglish ? "Select payment method" : "Seleccione el método de pago",
      }),
      banco_origen: z.string().min(1, isEnglish ? "Select the bank" : "Seleccione el banco de origen"),
      referencia: z
        .string()
        .min(4, isEnglish ? "Reference must have at least 4 digits" : "La referencia debe tener al menos 4 dígitos")
        .max(20, isEnglish ? "Reference cannot exceed 20 digits" : "La referencia no puede exceder 20 dígitos")
        .regex(/^[0-9]+$/, isEnglish ? "Reference can only contain numbers" : "La referencia solo puede contener números"),
      cedula_titular: z
        .string()
        .min(1, isEnglish ? "Holder ID is required" : "La cédula/ID del titular es requerida")
        .refine(
          (val) =>
            paisConfiguracion === "usa"
              ? /^\d{3}-?\d{2}-?\d{4}$|^\d{6,12}$/.test(val.trim())
              : /^[VvEeJjGgPp]-?\d{6,9}$/.test(val.trim()),
          paisConfiguracion === "usa"
            ? "Invalid ID format (e.g. 123-45-6789)"
            : "Formato inválido (ej: V-12345678)"
        ),
      telefono_cuenta: z
        .string()
        .min(1, isEnglish ? "Phone is required" : "El teléfono es requerido")
        .refine(
          (val) =>
            paisConfiguracion === "usa"
              ? /^\(\d{3}\)\s?\d{3}-?\d{4}$|^\d{3}-?\d{3}-?\d{4}$|^\d{10}$/.test(val.trim())
              : /^0\d{3}-?\d{7}$/.test(val.trim()),
          paisConfiguracion === "usa"
            ? "Invalid phone format (e.g. 555-123-4567)"
            : "Formato inválido (ej: 04121234567)"
        ),
      fecha_transferencia: z
        .string()
        .min(1, isEnglish ? "Date is required" : "La fecha es requerida")
        .refine(
          (dateStr) => dateStr >= minDateStr && dateStr <= todayStr,
          isEnglish
            ? "Transfer date must be within the last 30 days and not in the future"
            : "La fecha debe estar dentro de los últimos 30 días y no puede ser futura"
        ),
      monto: z.string().min(1),
    });
  }, [paisConfiguracion, isEnglish, minDateStr, todayStr]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<VerificacionPagoFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      monto: String(montoPagar.toFixed(2)),
      fecha_transferencia: todayStr,
      metodo_pago: paisConfiguracion === "usa" ? "transferencia" : "pago_movil",
    },
  });

  const metodoPago = watch("metodo_pago");

  useEffect(() => {
    const verificarEstadoPagos = async () => {
      try {
        const pagos = await apiClient.getPagos();
        const ahora = new Date();
        const mesActual = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const proximoMesDate = new Date(anioActual, ahora.getMonth() + 1, 1);
        const proximoMes = proximoMesDate.getMonth() + 1;
        const proximoAnio = proximoMesDate.getFullYear();

        const pagoConfirmadoMesActual = pagos.find(
          (p: any) => p.mes === mesActual && p.anio === anioActual && p.estado === "confirmado"
        );
        const pagoProximoMes = pagos.find(
          (p: any) =>
            p.mes === proximoMes &&
            p.anio === proximoAnio &&
            p.estado !== "rechazado"
        );

        const adelantado = Boolean(pagoConfirmadoMesActual && !pagoProximoMes);
        setEsPagoAdelantado(adelantado);

        if (adelantado && alumnoId) {
          const precioInfo = await apiClient.getPrecioAlumno(String(alumnoId), true);
          if (precioInfo?.precio_final !== undefined) {
            setMontoConDescuento(Number(precioInfo.precio_final));
            setValue("monto", Number(precioInfo.precio_final).toFixed(2));
            if (precioInfo.descuento_pago_adelantado > 0) {
              setDescuentoInfo({
                porcentaje: precioInfo.descuento_pago_adelantado,
                precioOriginal: Number(precioInfo.precio_base) + Number(precioInfo.costo_inscripcion || 0),
                precioFinal: Number(precioInfo.precio_final),
              });
            }
          }
        } else {
          setMontoConDescuento(montoPagar);
          setValue("monto", montoPagar.toFixed(2));
          setDescuentoInfo(null);
        }
      } catch (err) {
        console.error("Error consultando historial de pagos:", err);
      }
    };
    verificarEstadoPagos();
  }, [alumnoId, montoPagar, setValue]);

  const handleCopyDatosBancarios = async () => {
    if (!datosBancarios) return;
    try {
      await navigator.clipboard.writeText(datosBancarios);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({
        title: isEnglish ? "Could not copy" : "No se pudo copiar",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setComprobanteDataUrl(null);
      setComprobanteNombre("");
      return;
    }
    if (file.size > 700 * 1024) {
      toast({
        title: isEnglish ? "Image too large" : "Imagen demasiado grande",
        description: isEnglish
          ? "Maximum receipt size is 700 KB"
          : "El comprobante no debe superar los 700 KB",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setComprobanteDataUrl(String(reader.result));
      setComprobanteNombre(file.name);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: VerificacionPagoFormData) => {
    setLoading(true);
    try {
      const targetDate = new Date();
      if (esPagoAdelantado) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      const mesCorrespondiente = targetDate.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });

      const metodoPagoTexto = data.metodo_pago === "pago_movil" ? "Pago Móvil" : "Transferencia";
      const observaciones = esPagoAdelantado ? `Pago adelantado - ${mesCorrespondiente}` : null;

      await apiClient.createPago({
        id_alumno: alumnoId,
        mes: targetDate.getMonth() + 1,
        anio: targetDate.getFullYear(),
        monto: montoConDescuento,
        metodo_pago: metodoPagoTexto,
        referencia: data.referencia.trim(),
        banco_origen: data.banco_origen,
        cedula_titular: data.cedula_titular.trim(),
        telefono_cuenta: data.telefono_cuenta.trim(),
        fecha_pago: data.fecha_transferencia,
        estado: "pendiente",
        mes_correspondiente: mesCorrespondiente,
        comprobante: comprobanteDataUrl,
        observaciones,
      });

      toast({
        title: isEnglish ? "Payment sent for verification" : "Pago enviado a verificación",
        description: isEnglish
          ? "Your payment receipt was recorded as Pending. Administration will confirm it shortly."
          : "Tu comprobante quedó registrado en estado Pendiente. La administración lo verificará pronto.",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.data?.error ||
          error.message ||
          (isEnglish ? "Could not submit payment" : "No se pudo registrar el pago"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const equivalenteBs = (montoConDescuento * tasaCambio).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3.5">
        <div className="flex items-start gap-2.5">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">
              {isEnglish ? "Verification Process" : "Proceso de Verificación Administrativa"}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
              {isEnglish
                ? "Transfer to the Dojo's official account below, then submit the reference number. Your payment will remain Pending until verified by staff."
                : "Realiza la operación a los datos bancarios oficiales del Dojo y registra la referencia. El pago quedará en estado Pendiente hasta ser validado por recepción o administración."}
            </p>
          </div>
        </div>
      </div>

      {datosBancarios && (
        <div className="bg-muted/60 border border-border rounded-lg p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isEnglish ? "Dojo Bank Details" : "Datos Bancarios del Dojo"}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyDatosBancarios} className="h-7 text-xs gap-1.5">
              {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? (isEnglish ? "Copied" : "Copiado") : isEnglish ? "Copy" : "Copiar"}
            </Button>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono text-foreground bg-background p-2.5 rounded border">
            {datosBancarios}
          </pre>
        </div>
      )}

      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {isEnglish ? "Amount to Transfer:" : "Monto a Pagar:"}
          </span>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {monedaSistema === "BS." ? `Bs. ${equivalenteBs}` : `USD$ ${montoConDescuento.toFixed(2)}`}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {monedaSistema === "BS."
                ? `Equivalente: USD$ ${montoConDescuento.toFixed(2)} (Tasa: ${tasaCambio})`
                : `Equivalente: Bs. ${equivalenteBs} (Tasa: ${tasaCambio})`}
            </p>
          </div>
        </div>

        {esPagoAdelantado && (
          <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
            {isEnglish
              ? "Advance payment for next month detected."
              : "Pago adelantado correspondiente al próximo mes."}
            {descuentoInfo ? ` (-${descuentoInfo.porcentaje}% aplicado)` : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isEnglish ? "Payment Method *" : "Método de Pago *"}</Label>
          <Select
            value={metodoPago}
            onValueChange={(value) => setValue("metodo_pago", value as "transferencia" | "pago_movil", { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder={isEnglish ? "Select method" : "Seleccionar método"} />
            </SelectTrigger>
            <SelectContent>
              {paisConfiguracion !== "usa" && (
                <SelectItem value="pago_movil">{isEnglish ? "Mobile Payment (Pago Móvil)" : "Pago Móvil"}</SelectItem>
              )}
              <SelectItem value="transferencia">{isEnglish ? "Bank Transfer" : "Transferencia Bancaria"}</SelectItem>
            </SelectContent>
          </Select>
          {errors.metodo_pago && <p className="text-xs text-destructive">{errors.metodo_pago.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{isEnglish ? "Origin Bank *" : "Banco de Origen *"}</Label>
          <Select
            value={watch("banco_origen") || ""}
            onValueChange={(value) => setValue("banco_origen", value, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder={isEnglish ? "Select bank" : "Seleccione su banco"} />
            </SelectTrigger>
            <SelectContent>
              {(paisConfiguracion === "usa" ? BANCOS_ESTADOS_UNIDOS : BANCOS_VENEZUELA).map((banco) => (
                <SelectItem key={banco} value={banco}>
                  {banco}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.banco_origen && <p className="text-xs text-destructive">{errors.banco_origen.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="referencia">{isEnglish ? "Reference Number *" : "Número de Referencia *"}</Label>
          <Input
            id="referencia"
            {...register("referencia")}
            placeholder="12345678"
            maxLength={20}
            inputMode="numeric"
          />
          {errors.referencia && <p className="text-xs text-destructive">{errors.referencia.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecha_transferencia">{isEnglish ? "Transfer Date *" : "Fecha de Operación *"}</Label>
          <Input
            id="fecha_transferencia"
            type="date"
            min={minDateStr}
            max={todayStr}
            {...register("fecha_transferencia")}
          />
          {errors.fecha_transferencia && (
            <p className="text-xs text-destructive">{errors.fecha_transferencia.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cedula_titular">
            {paisConfiguracion === "usa"
              ? isEnglish
                ? "Account Holder ID *"
                : "ID del Titular *"
              : isEnglish
              ? "Account Holder Cedula *"
              : "Cédula del Titular *"}
          </Label>
          <Input
            id="cedula_titular"
            {...register("cedula_titular")}
            placeholder={paisConfiguracion === "usa" ? "123-45-6789" : "V-12345678"}
          />
          {errors.cedula_titular && <p className="text-xs text-destructive">{errors.cedula_titular.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono_cuenta">{isEnglish ? "Account Phone *" : "Teléfono Asociado *"}</Label>
          <Input
            id="telefono_cuenta"
            {...register("telefono_cuenta")}
            placeholder={paisConfiguracion === "usa" ? "555-123-4567" : "04121234567"}
          />
          {errors.telefono_cuenta && <p className="text-xs text-destructive">{errors.telefono_cuenta.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comprobante_img" className="flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          {isEnglish ? "Receipt Screenshot (Optional, max 700 KB)" : "Captura del Comprobante (Opcional, máx. 700 KB)"}
        </Label>
        <Input
          id="comprobante_img"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        {comprobanteNombre && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ {comprobanteNombre}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnglish ? "Submit Payment for Verification" : "Enviar Pago para Verificación"}
      </Button>
    </form>
  );
}
