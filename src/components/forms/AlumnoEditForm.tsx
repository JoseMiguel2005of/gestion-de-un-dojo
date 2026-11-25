import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useState, useEffect } from "react";

const alumnoSchema = z.object({
  cedula: z.string().min(1, "La cédula es requerida"),
  nombre: z.string().min(1, "El nombre es requerido"),
  fecha_nacimiento: z.string().min(1, "La fecha de nacimiento es requerida"),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  direccion: z.string().optional(),
  contacto_emergencia: z.string().optional(),
  telefono_emergencia: z.string().optional(),
  nombre_padre: z.string().optional(),
  telefono_padre: z.string().optional(),
  nombre_madre: z.string().optional(),
  telefono_madre: z.string().optional(),
  categoria_edad_id: z.string().optional(),
  cinta_id: z.string().optional(),
  sensei_id: z.string().optional(),
  representante_id: z.string().optional(),
  estado: z.union([z.boolean(), z.number()]).default(true),
});

type AlumnoFormData = z.infer<typeof alumnoSchema>;

interface AlumnoEditFormProps {
  alumnoId: string;
  onSuccess: () => void;
}

export function AlumnoEditForm({ alumnoId, onSuccess }: AlumnoEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [categoriasEdad, setCategoriasEdad] = useState<any[]>([]);
  const [cintas, setCintas] = useState<any[]>([]);
  const [senseis, setSenseis] = useState<any[]>([]);
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AlumnoFormData>({
    resolver: zodResolver(alumnoSchema),
  });


  const fechaNacimiento = watch("fecha_nacimiento");

  useEffect(() => {
    fetchData();
  }, [alumnoId]);

  useEffect(() => {
    if (fechaNacimiento) {
      filtrarCategoriasPorEdad(fechaNacimiento);
    } else {
      setCategoriasPermitidas([]);
    }
  }, [fechaNacimiento, categoriasEdad]);

  const formatearFecha = (fecha: string): string => {
    // Convertir fecha ISO o cualquier formato a yyyy-MM-dd
    if (!fecha) return '';
    const date = new Date(fecha);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchData = async () => {
    try {
      const [alumno, categoriasData, cintasData, senseisData, representantesData] = await Promise.all([
        apiClient.getAlumno(alumnoId),
        apiClient.getCategoriasEdad(),
        apiClient.getCintas(),
        apiClient.getSenseisDisponibles().catch(() => []),
        apiClient.getRepresentantes(),
      ]);
      setCategoriasEdad(categoriasData || []);
      setCintas(cintasData || []);
      setSenseis(senseisData || []);
      setRepresentantes(representantesData || []);

      if (alumno) {
        const fechaFormateada = formatearFecha(alumno.fecha_nacimiento);
        const edad = calcularEdad(fechaFormateada);

        setValue("cedula", alumno.cedula || "");
        setValue("nombre", alumno.nombre);
        setValue("fecha_nacimiento", fechaFormateada);
        setValue("telefono", alumno.telefono || "");
        setValue("email", alumno.email || "");
        setValue("direccion", alumno.direccion || "");
        setValue("contacto_emergencia", alumno.contacto_emergencia || "");
        setValue("telefono_emergencia", alumno.telefono_emergencia || "");
        setValue("nombre_padre", alumno.nombre_padre || "");
        setValue("telefono_padre", alumno.telefono_padre || "");
        setValue("nombre_madre", alumno.nombre_madre || "");
        setValue("telefono_madre", alumno.telefono_madre || "");
        setValue("cinta_id", String(alumno.id_cinta || ""));
        setValue("sensei_id", alumno.sensei_id ? String(alumno.sensei_id) : "none");
        setValue("representante_id", alumno.representante_id ? String(alumno.representante_id) : "none");
        setValue("estado", Boolean(alumno.estado));

        if (fechaFormateada && categoriasData && categoriasData.length > 0) {
          const filtradas = categoriasData.filter((cat: any) => 
            edad >= (cat.edad_min || 0) && edad <= (cat.edad_max || 150)
          );
          setCategoriasPermitidas(filtradas);

          if ((!alumno.id_categoria_edad || alumno.id_categoria_edad === null) && filtradas.length > 0) {
            setValue("categoria_edad_id", String(filtradas[0].id));
          } else if (alumno.id_categoria_edad) {
            setValue("categoria_edad_id", String(alumno.id_categoria_edad));
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    }
  };

  const calcularEdad = (fechaNac: string): number => {
    const hoy = new Date();
    const nacimiento = new Date(fechaNac);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  const filtrarCategoriasPorEdad = (fechaNac: string) => {
    if (!fechaNac || categoriasEdad.length === 0) {
      setCategoriasPermitidas([]);
      return;
    }

    const edad = calcularEdad(fechaNac);
    const filtradas = categoriasEdad.filter(cat => 
      edad >= (cat.edad_min || 0) && edad <= (cat.edad_max || 150)
    );
    
    setCategoriasPermitidas(filtradas);

    const categoriaSeleccionada = watch("categoria_edad_id");
    
    if (!categoriaSeleccionada || categoriaSeleccionada === "" || categoriaSeleccionada === "null") {
      if (filtradas.length > 0) {
        setValue("categoria_edad_id", String(filtradas[0].id));
      }
    } else if (categoriaSeleccionada && !filtradas.find(c => String(c.id) === categoriaSeleccionada)) {
      if (filtradas.length > 0) {
        setValue("categoria_edad_id", String(filtradas[0].id));
      } else {
        setValue("categoria_edad_id", "");
      }
      toast({
        title: "Atención",
        description: `La categoría se actualizó automáticamente para la edad del alumno (${edad} años)`,
        variant: "default",
      });
    }
  };

  const onSubmit = async (data: AlumnoFormData) => {
    setLoading(true);
    try {
      const payload = {
        cedula: data.cedula,
        nombre: data.nombre,
        fecha_nacimiento: data.fecha_nacimiento,
        telefono: data.telefono || null,
        email: data.email || null,
        direccion: data.direccion || null,
        contacto_emergencia: data.contacto_emergencia || null,
        telefono_emergencia: data.telefono_emergencia || null,
        nombre_padre: data.nombre_padre || null,
        telefono_padre: data.telefono_padre || null,
        nombre_madre: data.nombre_madre || null,
        telefono_madre: data.telefono_madre || null,
        id_categoria_edad: data.categoria_edad_id ? parseInt(data.categoria_edad_id) : null,
        id_cinta: data.cinta_id ? parseInt(data.cinta_id) : null,
        sensei_id: data.sensei_id && data.sensei_id !== "none" ? parseInt(data.sensei_id) : null,
        id_representante: data.representante_id && data.representante_id !== "none" ? parseInt(data.representante_id) : null,
        estado: data.estado === true || data.estado === 1,
      };
      
      await apiClient.updateAlumno(alumnoId, payload);
      
      toast({
        title: "Éxito",
        description: "Alumno actualizado correctamente",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cedula">Cédula *</Label>
          <Input id="cedula" {...register("cedula")} />
          {errors.cedula && <p className="text-sm text-destructive">{errors.cedula.message}</p>}
        </div>

        <div>
          <Label htmlFor="estado">Estado *</Label>
          <Select value={watch("estado") ? "true" : "false"} onValueChange={(val) => setValue("estado", val === "true")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Activo</SelectItem>
              <SelectItem value="false">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="nombre">Nombre Completo *</Label>
        <Input id="nombre" {...register("nombre")} placeholder="Ej: Juan Pérez" />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
      </div>

      <div>
        <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
        <Input id="fecha_nacimiento" type="date" {...register("fecha_nacimiento")} />
        {errors.fecha_nacimiento && <p className="text-sm text-destructive">{errors.fecha_nacimiento.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...register("telefono")} />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...register("direccion")} />
      </div>

      <div className="border-t pt-4 space-y-3">
        <h4 className="font-semibold text-sm">Contacto de Emergencia</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contacto_emergencia">Nombre del Contacto</Label>
            <Input id="contacto_emergencia" {...register("contacto_emergencia")} />
          </div>
          <div>
            <Label htmlFor="telefono_emergencia">Teléfono de Emergencia</Label>
            <Input id="telefono_emergencia" {...register("telefono_emergencia")} />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h4 className="font-semibold text-sm">Información de Padres</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nombre_padre">Nombre del Padre</Label>
            <Input id="nombre_padre" {...register("nombre_padre")} />
          </div>
          <div>
            <Label htmlFor="telefono_padre">Teléfono del Padre</Label>
            <Input id="telefono_padre" {...register("telefono_padre")} />
          </div>
          <div>
            <Label htmlFor="nombre_madre">Nombre de la Madre</Label>
            <Input id="nombre_madre" {...register("nombre_madre")} />
          </div>
          <div>
            <Label htmlFor="telefono_madre">Teléfono de la Madre</Label>
            <Input id="telefono_madre" {...register("telefono_madre")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="categoria_edad_id">Categoría de Edad</Label>
          <Select 
            value={watch("categoria_edad_id") || ""} 
            onValueChange={(value) => setValue("categoria_edad_id", value)}
            disabled={!fechaNacimiento || categoriasPermitidas.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !fechaNacimiento 
                  ? "Primero ingrese la fecha de nacimiento" 
                  : categoriasPermitidas.length === 0 
                    ? "No hay categorías disponibles para esta edad"
                    : "Seleccionar categoría"
              } />
            </SelectTrigger>
            <SelectContent>
              {categoriasPermitidas.map((categoria) => (
                <SelectItem key={categoria.id} value={String(categoria.id)}>
                  {categoria.nombre} ({categoria.edad_min}-{categoria.edad_max} años)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fechaNacimiento && categoriasPermitidas.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {calcularEdad(fechaNacimiento)} años - Categorías disponibles para esta edad
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="cinta_id">Cinta</Label>
          <Select 
            value={watch("cinta_id") || ""} 
            onValueChange={(value) => setValue("cinta_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cinta" />
            </SelectTrigger>
            <SelectContent>
              {cintas.map((cinta) => (
                <SelectItem key={cinta.id} value={String(cinta.id)}>
                  {cinta.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sensei_id">Instructor Asignado (Sensei)</Label>
          <Select
            value={watch("sensei_id") || "none"}
            onValueChange={(value) => setValue("sensei_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar instructor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {senseis.map((sensei) => (
                <SelectItem key={sensei.id} value={String(sensei.id)}>
                  {sensei.nombre_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="representante_id">Representante</Label>
          <Select
            value={watch("representante_id") || "none"}
            onValueChange={(value) => setValue("representante_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar representante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin representante</SelectItem>
              {representantes.map((rep) => (
                <SelectItem key={rep.id} value={String(rep.id)}>
                  {[rep.nombre, rep.apellido].filter(Boolean).join(" ")} ({rep.cedula})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : "Actualizar Alumno"}
      </Button>
    </form>
  );
}
