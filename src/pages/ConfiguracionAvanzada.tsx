import { useState } from "react";
import { Users, DollarSign, Clock, Database, ScrollText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/useLanguage";
import { UsuariosTab } from "@/components/admin/UsuariosTab";
import { PagosConfigTab } from "@/components/admin/PagosConfigTab";
import { HorariosAdminTab } from "@/components/admin/HorariosAdminTab";
import { BackupTab } from "@/components/admin/BackupTab";
import { LogsTab } from "@/components/admin/LogsTab";

export default function ConfiguracionAvanzada() {
  const { isEnglish } = useLanguage();
  const [activeTab, setActiveTab] = useState("usuarios");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">
          {isEnglish ? "Advanced Administration" : "Administración Avanzada"}
        </h2>
        <p className="text-muted-foreground mt-1">
          {isEnglish
            ? "Manage staff roles, billing parameters, schedules, PostgreSQL backups, and security logs"
            : "Gestiona cuentas y roles RBAC, parámetros financieros, horarios, respaldos PostgreSQL y auditoría"}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="w-4 h-4" />
            <span>{isEnglish ? "Users" : "Usuarios"}</span>
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-1.5">
            <DollarSign className="w-4 h-4" />
            <span>{isEnglish ? "Billing" : "Pagos"}</span>
          </TabsTrigger>
          <TabsTrigger value="horarios" className="gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{isEnglish ? "Schedules" : "Horarios"}</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5">
            <Database className="w-4 h-4" />
            <span>{isEnglish ? "Backup" : "Respaldos"}</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="w-4 h-4" />
            <span>{isEnglish ? "Audit Logs" : "Bitácora"}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>

        <TabsContent value="pagos">
          <PagosConfigTab />
        </TabsContent>

        <TabsContent value="horarios">
          <HorariosAdminTab />
        </TabsContent>

        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
