import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Database, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function LogsTab() {
  const { isEnglish } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const cargarLogs = useCallback(async () => {
    try {
      const data = await apiClient.getLogs(100);
      setLogs(data || []);
    } catch (error) {
      console.error("Error cargando bitácora de auditoría:", error);
    }
  }, []);

  useEffect(() => {
    void cargarLogs();
  }, [cargarLogs]);

  const limpiarLogsAntiguos = async () => {
    setConfirmCleanup(false);
    try {
      const result = await apiClient.limpiarLogs(90);
      toast({
        title: isEnglish ? "Old logs purged" : "Registros antiguos eliminados",
        description: result.message || `${result.deletedCount} registros eliminados`,
      });
      void cargarLogs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getBadgeClass = (accion: string) => {
    switch (accion) {
      case "LOGIN":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
      case "CREAR":
      case "CREATE":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
      case "ACTUALIZAR":
      case "CONFIGURAR":
      case "UPDATE":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
      case "ELIMINAR":
      case "DELETE":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
      case "EXPORTAR":
      case "IMPORTAR":
      case "EXPORT":
      case "IMPORT":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>{isEnglish ? "Audit Activity Log" : "Bitácora de Auditoría"}</CardTitle>
            <CardDescription>
              {isEnglish
                ? `Latest system security and administrative events (${logs.length})`
                : `Historial de eventos administrativos y de seguridad (${logs.length} registros)`}
            </CardDescription>
          </div>
          <Button
            onClick={() => setConfirmCleanup(true)}
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isEnglish ? "Purge > 90 Days" : "Limpiar > 90 días"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{isEnglish ? "No activity logs recorded yet" : "No hay registros de actividad"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isEnglish ? "Timestamp" : "Fecha y Hora"}</TableHead>
                  <TableHead>{isEnglish ? "User" : "Usuario"}</TableHead>
                  <TableHead>{isEnglish ? "Action" : "Acción"}</TableHead>
                  <TableHead>{isEnglish ? "Module" : "Módulo"}</TableHead>
                  <TableHead>{isEnglish ? "Description" : "Descripción"}</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString(isEnglish ? "en-US" : "es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{log.nombre_completo || log.username || "Sistema"}</div>
                      {log.username && <div className="text-xs text-muted-foreground">@{log.username}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getBadgeClass(log.accion)}`}>
                        {log.accion}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                        {log.modulo}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={log.descripcion}>
                      {log.descripcion}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.ip_address || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <ConfirmDialog
          open={confirmCleanup}
          onOpenChange={setConfirmCleanup}
          title={isEnglish ? "Purge Old Audit Logs" : "Limpiar Bitácora Antigua"}
          description={
            isEnglish
              ? "Are you sure you want to delete audit logs older than 90 days?"
              : "¿Estás seguro de eliminar los registros de auditoría con más de 90 días de antigüedad?"
          }
          confirmText={isEnglish ? "Purge" : "Eliminar"}
          cancelText={isEnglish ? "Cancel" : "Cancelar"}
          onConfirm={limpiarLogsAntiguos}
        />
      </CardContent>
    </Card>
  );
}
