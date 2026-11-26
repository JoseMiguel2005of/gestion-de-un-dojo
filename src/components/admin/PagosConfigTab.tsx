import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function PagosConfigTab() {
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [editandoPrecio, setEditandoPrecio] = useState<Record<number, boolean>>({});
  const [preciosTemporales, setPreciosTemporales] = useState<Record<number, number>>({});

  const [configPagos, setConfigPagos] = useState({
    dia_corte: 5,
    descuento_pago_adelantado: 0,
    costo_inscripcion: 15,
    moneda: "USD$",
    metodos_pago: ["Efectivo", "Transferencia Bancaria", "Pago Móvil"],
    datos_bancarios: "",
    pais_configuracion: "venezuela",
    tipo_cambio_usd_bs: 220,
  });

  const cargarConfigPagos = useCallback(async () => {
    try {
      const [data, categoriasData] = await Promise.all([
        apiClient.getConfigPagos(),
        apiClient.getCategoriasEdad(),
      ]);

      let metodos = data.metodos_pago;
      if (typeof metodos === "string") {
        try {
          metodos = JSON.parse(metodos);
        } catch {
          metodos = ["Transferencia Bancaria", "Pago Móvil"];
        }
      }

      setConfigPagos((prev) => ({
        ...prev,
        ...data,
        metodos_pago: Array.isArray(metodos) ? metodos : prev.metodos_pago,
        pais_configuracion: data.pais_configuracion || "venezuela",
        tipo_cambio_usd_bs:
          data.tipo_cambio_usd_bs && !Number.isNaN(Number(data.tipo_cambio_usd_bs))
            ? Number(data.tipo_cambio_usd_bs)
            : 220,
        costo_inscripcion:
          data.costo_inscripcion !== undefined ? Number(data.costo_inscripcion) : 15,
      }));

      setCategorias(categoriasData || []);
      const temp: Record<number, number> = {};
      (categoriasData || []).forEach((cat: any) => {
        temp[cat.id] = Number(cat.precio_mensualidad) || 0;
      });
      setPreciosTemporales(temp);
    } catch (error) {
      console.error("Error cargando configuración de pagos:", error);
    }
  }, []);

  useEffect(() => {
    void cargarConfigPagos();
  }, [cargarConfigPagos]);

  const guardarConfigPagos = async () => {
    setLoading(true);
    try {
      const payload = {
        ...configPagos,
        tipo_cambio_usd_bs:
          configPagos.tipo_cambio_usd_bs && configPagos.tipo_cambio_usd_bs > 0
            ? configPagos.tipo_cambio_usd_bs
            : 220,
      };
      await apiClient.updateConfigPagos(payload);
      setConfigPagos(payload);
      toast({
        title: isEnglish ? "Payment settings saved" : "Configuración de pagos guardada",
      });
      window.dispatchEvent(new CustomEvent("config-updated"));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const guardarPrecioCategoria = async (categoriaId: number) => {
    try {
      const cat = categorias.find((c) => c.id === categoriaId);
      if (!cat) return;

      await apiClient.updateCategoriaEdad(String(categoriaId), {
        nombre: cat.nombre,
        edad_min: cat.edad_min ?? 6,
        edad_max: cat.edad_max ?? 99,
        cinta_maxima: cat.cinta_maxima || null,
        orden: cat.orden ?? 99,
        precio_mensualidad: preciosTemporales[categoriaId],
      });

      toast({
        title: isEnglish ? "Monthly fee updated" : "Mensualidad actualizada",
        description: `${cat.nombre}: USD$ ${Number(preciosTemporales[categoriaId] || 0).toFixed(2)}`,
      });
      setEditandoPrecio({ ...editandoPrecio, [categoriaId]: false });
      void cargarConfigPagos();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEnglish ? "Billing & Currency Parameters" : "Parámetros de Facturación y Moneda"}</CardTitle>
          <CardDescription>
            {isEnglish
              ? "Configure country document rules, currency display, exchange rate, and bank details"
              : "Configura país de operación, moneda principal, tasa de cambio USD$/Bs. y cuentas receptoras"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isEnglish ? "Operating Country" : "País de Operación"}</Label>
              <Select
                value={configPagos.pais_configuracion}
                onValueChange={(value) => {
                  const nuevosMetodos =
                    value === "usa"
                      ? ["Transferencia Bancaria", "Efectivo"]
                      : ["Pago Móvil", "Transferencia Bancaria", "Efectivo"];
                  setConfigPagos({
                    ...configPagos,
                    pais_configuracion: value,
                    metodos_pago: nuevosMetodos,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venezuela">Venezuela</SelectItem>
                  <SelectItem value="usa">{isEnglish ? "United States" : "Estados Unidos"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Display Currency" : "Moneda de Visualización"}</Label>
              <Select
                value={configPagos.moneda}
                onValueChange={(value) => setConfigPagos({ ...configPagos, moneda: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD$">USD$ - Dólar</SelectItem>
                  <SelectItem value="BS.">
                    BS. - Bolívar (× {configPagos.tipo_cambio_usd_bs || 220})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Exchange Rate (1 USD to Bs.)" : "Tasa de Cambio (1 USD a Bs.)"}</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={configPagos.tipo_cambio_usd_bs || ""}
                onChange={(e) =>
                  setConfigPagos({
                    ...configPagos,
                    tipo_cambio_usd_bs: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Cutoff Day of Month" : "Día de Corte Mensual"}</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={configPagos.dia_corte}
                onChange={(e) =>
                  setConfigPagos({
                    ...configPagos,
                    dia_corte: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Early Payment Discount (%)" : "Descuento Pago Adelantado (%)"}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={configPagos.descuento_pago_adelantado}
                onChange={(e) =>
                  setConfigPagos({
                    ...configPagos,
                    descuento_pago_adelantado: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{isEnglish ? "Registration Fee (USD$)" : "Costo de Inscripción (USD$)"}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={configPagos.costo_inscripcion}
                onChange={(e) =>
                  setConfigPagos({
                    ...configPagos,
                    costo_inscripcion: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isEnglish ? "Bank & Mobile Payment Details" : "Datos Bancarios y Pago Móvil del Dojo"}</Label>
            <Textarea
              rows={4}
              placeholder="Banco, RIF/Cédula, Teléfono Pago Móvil, Cuenta..."
              value={configPagos.datos_bancarios || ""}
              onChange={(e) => setConfigPagos({ ...configPagos, datos_bancarios: e.target.value })}
            />
          </div>

          <Button onClick={guardarConfigPagos} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading
              ? isEnglish
                ? "Saving..."
                : "Guardando..."
              : isEnglish
                ? "Save Payment Configuration"
                : "Guardar Configuración de Pagos"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEnglish ? "Monthly Fee by Age Category" : "Mensualidad por Categoría de Edad"}</CardTitle>
          <CardDescription>
            {isEnglish
              ? "Synchronized directly with public.categorias_edad"
              : "Conectado directamente al catálogo oficial de categorías de edad"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEnglish ? "Age Category" : "Categoría de Edad"}</TableHead>
                <TableHead>{isEnglish ? "Range & Max Belt" : "Rango / Cinta Máx."}</TableHead>
                <TableHead>{isEnglish ? "Monthly Fee (USD$)" : "Precio Mensual (USD$)"}</TableHead>
                <TableHead className="text-right">{isEnglish ? "Actions" : "Acciones"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {isEnglish ? "No categories registered" : "No hay categorías registradas"}
                  </TableCell>
                </TableRow>
              ) : (
                categorias.map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-semibold">{cat.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.edad_min}–{cat.edad_max} {isEnglish ? "years" : "años"}
                      {cat.cinta_maxima ? ` • Máx: ${cat.cinta_maxima}` : ""}
                    </TableCell>
                    <TableCell>
                      {editandoPrecio[cat.id] ? (
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          className="w-32"
                          value={preciosTemporales[cat.id] ?? 0}
                          onChange={(e) =>
                            setPreciosTemporales({
                              ...preciosTemporales,
                              [cat.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      ) : (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          USD$ {Number(cat.precio_mensualidad || 0).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editandoPrecio[cat.id] ? (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditandoPrecio({ ...editandoPrecio, [cat.id]: false })}
                          >
                            {isEnglish ? "Cancel" : "Cancelar"}
                          </Button>
                          <Button size="sm" onClick={() => guardarPrecioCategoria(cat.id)}>
                            <Save className="w-4 h-4 mr-1" />
                            {isEnglish ? "Save" : "Guardar"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditandoPrecio({ ...editandoPrecio, [cat.id]: true })}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {isEnglish ? "Edit" : "Editar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
