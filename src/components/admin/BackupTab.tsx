import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function BackupTab() {
  const { isEnglish } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [integridad, setIntegridad] = useState<any>(null);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargarDiagnostico = useCallback(async () => {
    try {
      const [statsData, integridadData] = await Promise.all([
        apiClient.getStats(),
        apiClient.verificarIntegridad(),
      ]);
      setStats(statsData);
      setIntegridad(integridadData);
    } catch (error) {
      console.error("Error cargando diagnóstico de respaldo:", error);
    }
  }, []);

  useEffect(() => {
    void cargarDiagnostico();
  }, [cargarDiagnostico]);

  const exportarJSON = async () => {
    setProcesando(true);
    try {
      await apiClient.exportarJSON();
      await apiClient.registrarBackup();
      toast({
        title: isEnglish ? "JSON Backup exported" : "Respaldo JSON exportado exitosamente",
      });
      void cargarDiagnostico();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  const exportarSQL = async () => {
    setProcesando(true);
    try {
      await apiClient.exportarSQL();
      await apiClient.registrarBackup();
      toast({
        title: isEnglish ? "PostgreSQL SQL exported" : "Respaldo SQL PostgreSQL exportado exitosamente",
      });
      void cargarDiagnostico();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarImportacionJSON = async () => {
    if (!archivoPendiente) return;
    const file = archivoPendiente;
    setArchivoPendiente(null);
    setProcesando(true);

    try {
      const resp = await apiClient.importarJSON(file);
      toast({
        title: isEnglish ? "Backup restored" : "Respaldo JSON importado",
        description: isEnglish
          ? `${resp.registros_importados} record(s) synchronized`
          : `Se sincronizaron ${resp.registros_importados} registro(s) en PostgreSQL`,
      });
      void cargarDiagnostico();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEnglish ? "PostgreSQL Backup & Integrity" : "Respaldos PostgreSQL e Integridad"}</CardTitle>
        <CardDescription>
          {isEnglish
            ? "Export complete relational snapshots (JSON or PostgreSQL SQL) and verify referential health"
            : "Exporta copias relacionales completas (JSON o SQL estándar PostgreSQL) y verifica la integridad de los catálogos"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={exportarJSON}
            disabled={procesando}
            className="h-24 flex flex-col gap-1"
          >
            <Download className="w-6 h-6" />
            <span>{isEnglish ? "Export JSON Backup" : "Exportar Respaldo JSON"}</span>
            <span className="text-xs opacity-80 font-normal">
              {isEnglish ? "Full system snapshot" : "Copia estructurada importable"}
            </span>
          </Button>

          <Button
            onClick={exportarSQL}
            disabled={procesando}
            variant="secondary"
            className="h-24 flex flex-col gap-1"
          >
            <Download className="w-6 h-6" />
            <span>{isEnglish ? "Export PostgreSQL (.sql)" : "Exportar SQL PostgreSQL"}</span>
            <span className="text-xs opacity-80 font-normal">
              {isEnglish ? "Compatible with psql & Supabase SQL Editor" : "Compatible con psql y Supabase SQL Editor"}
            </span>
          </Button>

          <div className="h-24 flex flex-col">
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setArchivoPendiente(file);
              }}
              className="hidden"
              id="import-json-backup"
            />
            <Button
              type="button"
              variant="outline"
              disabled={procesando}
              onClick={() => document.getElementById("import-json-backup")?.click()}
              className="h-24 flex flex-col gap-1"
            >
              <Upload className="w-6 h-6" />
              <span>{isEnglish ? "Import JSON Backup" : "Importar Respaldo JSON"}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {isEnglish ? "Safe FK-ordered upsert" : "Sincronización segura por orden de llaves"}
              </span>
            </Button>
          </div>
        </div>

        {stats && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">
              {isEnglish ? "Database Record Summary" : "Resumen de Registros en Base de Datos"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: isEnglish ? "Students" : "Alumnos", val: stats.total_alumnos },
                { label: isEnglish ? "Payments" : "Pagos", val: stats.total_pagos ?? 0 },
                { label: isEnglish ? "Attendance" : "Asistencias", val: stats.total_asistencias ?? 0 },
                { label: isEnglish ? "Evaluations" : "Evaluaciones", val: stats.total_evaluaciones },
                { label: isEnglish ? "Users" : "Usuarios", val: stats.total_usuarios },
                { label: isEnglish ? "Audit Logs" : "Auditoría", val: stats.total_logs },
              ].map((kpi) => (
                <div key={kpi.label} className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold text-foreground">{kpi.val}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEnglish ? "Last registered export:" : "Último respaldo registrado:"}{" "}
              <strong className="text-foreground">
                {stats.ultimo_backup && stats.ultimo_backup !== "Nunca"
                  ? new Date(stats.ultimo_backup).toLocaleString(isEnglish ? "en-US" : "es-ES")
                  : isEnglish
                    ? "Never"
                    : "Nunca"}
              </strong>
            </p>
          </div>
        )}

        {integridad && (
          <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">
                {isEnglish ? "Referential Integrity Check" : "Diagnóstico de Integridad Referencial"}
              </h3>
            </div>
            <p className="text-sm">
              {isEnglish ? "Status:" : "Estado:"}{" "}
              <span
                className={
                  integridad.estado === "correcto"
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "font-semibold text-amber-600 dark:text-amber-400"
                }
              >
                {integridad.estado === "correcto"
                  ? isEnglish
                    ? "✓ Healthy (0 issues)"
                    : "✓ Íntegro (0 inconsistencias)"
                  : `${integridad.total_problemas} ${isEnglish ? "warning(s)" : "observación(es)"}`}
              </span>
            </p>
            {Array.isArray(integridad.problemas) && integridad.problemas.length > 0 && (
              <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                {integridad.problemas.map((prob: any, idx: number) => (
                  <li key={idx}>{prob.mensaje}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ConfirmDialog
          open={Boolean(archivoPendiente)}
          onOpenChange={(open) => {
            if (!open) setArchivoPendiente(null);
          }}
          title={isEnglish ? "Import JSON Backup" : "Importar Respaldo JSON"}
          description={
            isEnglish
              ? `File "${archivoPendiente?.name || ""}" will be synchronized into PostgreSQL respecting foreign key dependencies. Continue?`
              : `Se sincronizarán los datos del archivo "${archivoPendiente?.name || ""}" en PostgreSQL respetando el orden de llaves foráneas. ¿Deseas continuar?`
          }
          confirmText={isEnglish ? "Import" : "Importar"}
          cancelText={isEnglish ? "Cancel" : "Cancelar"}
          onConfirm={ejecutarImportacionJSON}
        />
      </CardContent>
    </Card>
  );
}
