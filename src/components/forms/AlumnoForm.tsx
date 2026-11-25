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
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type PaisConfig = "venezuela" | "usa";

const validarDocumentoPorPais = (val: string, pais: PaisConfig): boolean => {
  const limpio = val.trim();
  if (pais === "usa") {
    return /^\d{3}-?\d{2}-?\d{4}$|^\d{9}$|^[A-Za-z0-9-]{6,15}$/.test(limpio);
  }
  return /^[VvEeJjGgPp]-?\d{6,9}$/.test(limpio);
};

const validarTelefonoPorPais = (val: string | undefined, pais: PaisConfig): boolean => {
  if (!val || !val.trim()) return true;
  const limpio = val.trim();
  if (pais === "usa") {
    return /^\(\d{3}\)\s?\d{3}-?\d{4}$|^\d{3}-?\d{3}-?\d{4}$|^\+?1?\d{10}$/.test(limpio);
  }
  return /^0\d{3}-?\d{7}$/.test(limpio);
};

const createAlumnoSchema = (isEnglish: boolean, pais: PaisConfig) => {
  const esUsa = pais === "usa";
  const msgDoc = esUsa
    ? isEnglish
      ? "Invalid US ID format (e.g., 123-45-6789)"
      : "Formato de documento USA inválido (ej: 123-45-6789)"
    : isEnglish
      ? "Invalid Venezuelan ID format (e.g., V-12345678)"
      : "Formato de cédula inválido (ej: V-12345678 o V12345678)";

  const msgTel = esUsa
    ? isEnglish
      ? "Invalid US phone format (e.g., (555) 123-4567)"
      : "Formato de teléfono USA inválido (ej: (555) 123-4567)"
    : isEnglish
      ? "Invalid Venezuelan phone format (e.g., 04121234567)"
      : "Formato de teléfono inválido (ej: 04121234567 o 0412-1234567)";

  return z.object({
    cedula: z
      .string()
      .min(1, isEnglish ? "ID is required" : "La cédula es requerida")
      .refine((val) => validarDocumentoPorPais(val, pais), msgDoc),
    nombre: z
      .string()
      .min(2, isEnglish ? "Name must have at least 2 characters" : "El nombre debe tener al menos 2 caracteres")
      .max(100, isEnglish ? "Name cannot exceed 100 characters" : "El nombre no puede exceder 100 caracteres"),
    fecha_nacimiento: z
      .string()
      .min(1, isEnglish ? "Birth date is required" : "La fecha de nacimiento es requerida")
      .refine((date) => {
        const birthDate = new Date(date);
        const today = new Date();
        const minDate = new Date("1935-01-01");
        const maxDate = new Date(today.getFullYear() - 1, 11, 31);
        return birthDate >= minDate && birthDate <= maxDate;
      }, isEnglish ? "Date must be between 1935 and last year" : "La fecha debe estar entre 1935 y el año pasado"),
    telefono: z
      .string()
      .optional()
      .refine((val) => validarTelefonoPorPais(val, pais), msgTel),
    email: z
      .string()
      .email(isEnglish ? "Invalid email" : "Email inválido")
      .optional()
      .or(z.literal("")),
    direccion: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim().length === 0 || val.trim().length >= 10,
        isEnglish ? "Address must have at least 10 characters" : "La dirección debe tener al menos 10 caracteres"
      ),
    categoria_edad_id: z.string().optional(),
    cinta_id: z.string().optional(),
    sensei_id: z.string().optional(),
    representante_id: z.string().optional(),
    contacto_emergencia: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim().length === 0 || val.trim().length >= 2,
        isEnglish ? "Emergency contact must have at least 2 characters" : "El contacto de emergencia debe tener al menos 2 caracteres"
      ),
    telefono_emergencia: z
      .string()
      .optional()
      .refine((val) => validarTelefonoPorPais(val, pais), msgTel),
    nombre_padre: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim().length === 0 || val.trim().length >= 2,
        isEnglish ? "Father's name must have at least 2 characters" : "El nombre del padre debe tener al menos 2 caracteres"
      ),
    telefono_padre: z
      .string()
      .optional()
      .refine((val) => validarTelefonoPorPais(val, pais), msgTel),
    nombre_madre: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim().length === 0 || val.trim().length >= 2,
        isEnglish ? "Mother's name must have at least 2 characters" : "El nombre de la madre debe tener al menos 2 caracteres"
      ),
    telefono_madre: z
      .string()
      .optional()
      .refine((val) => validarTelefonoPorPais(val, pais), msgTel),
  });
};

type AlumnoFormData = z.infer<ReturnType<typeof createAlumnoSchema>>;

interface AlumnoFormProps {
  onSuccess: () => void;
}

export function AlumnoForm({ onSuccess }: AlumnoFormProps) {
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paisConfig, setPaisConfig] = useState<PaisConfig>("venezuela");
  const [categoriasEdad, setCategoriasEdad] = useState<any[]>([]);
  const [cintas, setCintas] = useState<any[]>([]);
  const [senseis, setSenseis] = useState<any[]>([]);
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<any[]>([]);

  const schema = useMemo(() => createAlumnoSchema(isEnglish, paisConfig), [isEnglish, paisConfig]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AlumnoFormData>({
    resolver: zodResolver(schema),
  });

  const fechaNacimiento = watch("fecha_nacimiento");
  const placeholderDoc = paisConfig === "usa" ? "123-45-6789" : "V-12345678";
  const placeholderTel = paisConfig === "usa" ? "(555) 123-4567" : "04121234567";

  useEffect(() => {
    fetchCategoriasEdad();
    fetchCintas();
    fetchSenseis();
    fetchRepresentantes();
    apiClient
      .getConfigPagos()
      .then((cfg) => {
        if (cfg?.pais_configuracion) {
          setPaisConfig(String(cfg.pais_configuracion).toLowerCase() === "usa" ? "usa" : "venezuela");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (fechaNacimiento) {
      filtrarCategoriasPorEdad(fechaNacimiento);
    } else {
      setCategoriasPermitidas([]);
    }
  }, [fechaNacimiento, categoriasEdad]);

  const fetchCategoriasEdad = async () => {
    try {
      const categorias = await apiClient.getCategoriasEdad();
      setCategoriasEdad(categorias || []);
    } catch (error) {
      console.error("Error cargando categorías de edad:", error);
    }
  };

  const fetchCintas = async () => {
    try {
      const cintasData = await apiClient.getCintas();
      setCintas(cintasData || []);
    } catch (error) {
      console.error("Error cargando cintas:", error);
    }
  };

  const fetchSenseis = async () => {
    try {
      const senseisData = await apiClient.getSenseisDisponibles();
      setSenseis(senseisData || []);
    } catch (error) {
      console.error("Error cargando instructores:", error);
    }
  };

  const fetchRepresentantes = async () => {
    try {
      const representantesData = await apiClient.getRepresentantes();
      setRepresentantes(representantesData || []);
    } catch (error) {
      console.error("Error cargando representantes:", error);
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
    const filtradas = categoriasEdad.filter(
      (cat) => edad >= (cat.edad_min || 0) && edad <= (cat.edad_max || 150)
    );

    setCategoriasPermitidas(filtradas);

    const categoriaSeleccionada = watch("categoria_edad_id");
    if (categoriaSeleccionada && !filtradas.find((c) => String(c.id) === categoriaSeleccionada)) {
      setValue("categoria_edad_id", "");
      toast({
        title: isEnglish ? "Attention" : "Atención",
        description: isEnglish
          ? `The selected category does not match the student's age (${edad} years)`
          : `La categoría seleccionada no corresponde a la edad del alumno (${edad} años)`,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: AlumnoFormData) => {
    setLoading(true);
    try {
      const edad = calcularEdad(data.fecha_nacimiento);
      const esMayorEdad = edad >= 18;

      await apiClient.createAlumno({
        cedula: data.cedula.trim(),
        nombre: data.nombre.trim(),
        fecha_nacimiento: data.fecha_nacimiento,
        telefono: data.telefono?.trim() || null,
        email: data.email?.trim() || null,
        direccion: data.direccion?.trim() || null,
        id_categoria_edad: data.categoria_edad_id ? parseInt(data.categoria_edad_id) : null,
        id_cinta: data.cinta_id ? parseInt(data.cinta_id) : null,
        sensei_id: data.sensei_id && data.sensei_id !== "none" ? parseInt(data.sensei_id) : null,
        id_representante: esMayorEdad ? null : data.representante_id ? parseInt(data.representante_id) : null,
        contacto_emergencia: data.contacto_emergencia?.trim() || null,
        telefono_emergencia: data.telefono_emergencia?.trim() || null,
        nombre_padre: data.nombre_padre?.trim() || null,
        telefono_padre: data.telefono_padre?.trim() || null,
        nombre_madre: data.nombre_madre?.trim() || null,
        telefono_madre: data.telefono_madre?.trim() || null,
      });

      toast({
        title: isEnglish ? "Success" : "Éxito",
        description: isEnglish ? "Student registered successfully" : "Alumno registrado correctamente",
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
      <div className="space-y-2">
        <Label htmlFor="cedula">{isEnglish ? "ID Document *" : "Cédula / Documento *"}</Label>
        <Input
          id="cedula"
          {...register("cedula")}
          placeholder={placeholderDoc}
        />
        {errors.cedula && <p className="text-sm text-destructive">{errors.cedula.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombre">{isEnglish ? "Full Name *" : "Nombre Completo *"}</Label>
        <Input
          id="nombre"
          {...register("nombre")}
          placeholder={isEnglish ? "Ex: Juan Perez" : "Ej: Juan Pérez"}
        />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fecha_nacimiento">{isEnglish ? "Birth Date *" : "Fecha de Nacimiento *"}</Label>
        <Input
          id="fecha_nacimiento"
          type="date"
          {...register("fecha_nacimiento")}
          min="1935-01-01"
          max={new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split("T")[0]}
        />
        {errors.fecha_nacimiento && (
          <p className="text-sm text-destructive">{errors.fecha_nacimiento.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="telefono">{isEnglish ? "Phone" : "Teléfono"}</Label>
          <Input
            id="telefono"
            {...register("telefono")}
            placeholder={placeholderTel}
          />
          {errors.telefono && <p className="text-sm text-destructive">{errors.telefono.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="ejemplo@correo.com"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="direccion">{isEnglish ? "Address" : "Dirección"}</Label>
        <Input
          id="direccion"
          {...register("direccion")}
          placeholder={isEnglish ? "Street, Building, Apartment" : "Ej: Av. Principal, Edificio ABC, Piso 2"}
        />
        {errors.direccion && <p className="text-sm text-destructive">{errors.direccion.message}</p>}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3 text-sm">{isEnglish ? "Emergency Contact" : "Contacto de Emergencia"}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contacto_emergencia">{isEnglish ? "Contact Name" : "Nombre del Contacto"}</Label>
            <Input
              id="contacto_emergencia"
              {...register("contacto_emergencia")}
              placeholder={isEnglish ? "Ex: Maria Gonzalez" : "Ej: María González"}
            />
            {errors.contacto_emergencia && (
              <p className="text-sm text-destructive">{errors.contacto_emergencia.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_emergencia">{isEnglish ? "Emergency Phone" : "Teléfono de Emergencia"}</Label>
            <Input
              id="telefono_emergencia"
              {...register("telefono_emergencia")}
              placeholder={placeholderTel}
            />
            {errors.telefono_emergencia && (
              <p className="text-sm text-destructive">{errors.telefono_emergencia.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3 text-sm">{isEnglish ? "Parents Information" : "Información de Padres"}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_padre">{isEnglish ? "Father's Name" : "Nombre del Padre"}</Label>
            <Input
              id="nombre_padre"
              {...register("nombre_padre")}
              placeholder={isEnglish ? "Ex: John Perez" : "Ej: Juan Pérez"}
            />
            {errors.nombre_padre && <p className="text-sm text-destructive">{errors.nombre_padre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_padre">{isEnglish ? "Father's Phone" : "Teléfono del Padre"}</Label>
            <Input
              id="telefono_padre"
              {...register("telefono_padre")}
              placeholder={placeholderTel}
            />
            {errors.telefono_padre && <p className="text-sm text-destructive">{errors.telefono_padre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre_madre">{isEnglish ? "Mother's Name" : "Nombre de la Madre"}</Label>
            <Input
              id="nombre_madre"
              {...register("nombre_madre")}
              placeholder={isEnglish ? "Ex: Maria Gonzalez" : "Ej: María González"}
            />
            {errors.nombre_madre && <p className="text-sm text-destructive">{errors.nombre_madre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_madre">{isEnglish ? "Mother's Phone" : "Teléfono de la Madre"}</Label>
            <Input
              id="telefono_madre"
              {...register("telefono_madre")}
              placeholder={placeholderTel}
            />
            {errors.telefono_madre && <p className="text-sm text-destructive">{errors.telefono_madre.message}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoria_edad_id">{isEnglish ? "Age Category" : "Categoría de Edad"}</Label>
          <Select
            onValueChange={(value) => setValue("categoria_edad_id", value)}
            value={watch("categoria_edad_id") || ""}
            disabled={!fechaNacimiento || categoriasPermitidas.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !fechaNacimiento
                    ? isEnglish
                      ? "First enter birth date"
                      : "Primero ingrese la fecha de nacimiento"
                    : categoriasPermitidas.length === 0
                      ? isEnglish
                        ? "No categories available for this age"
                        : "No hay categorías disponibles para esta edad"
                      : isEnglish
                        ? "Select category"
                        : "Seleccionar categoría"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {categoriasPermitidas.map((categoria) => (
                <SelectItem key={categoria.id} value={String(categoria.id)}>
                  {categoria.nombre} ({categoria.edad_min}-{categoria.edad_max} {isEnglish ? "years" : "años"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cinta_id">{isEnglish ? "Belt" : "Cinta"}</Label>
          <Select onValueChange={(value) => setValue("cinta_id", value)} value={watch("cinta_id") || ""}>
            <SelectTrigger>
              <SelectValue placeholder={isEnglish ? "Select belt" : "Seleccionar cinta"} />
            </SelectTrigger>
            <SelectContent>
              {cintas.map((cinta) => (
                <SelectItem key={cinta.id} value={String(cinta.id)}>
                  {isEnglish && cinta.nombre_en ? cinta.nombre_en : cinta.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sensei_id">{isEnglish ? "Assigned Instructor (Sensei)" : "Instructor Asignado (Sensei)"}</Label>
        <Select onValueChange={(value) => setValue("sensei_id", value)} value={watch("sensei_id") || "none"}>
          <SelectTrigger>
            <SelectValue placeholder={isEnglish ? "Select instructor" : "Seleccionar instructor"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{isEnglish ? "Unassigned" : "Sin asignar"}</SelectItem>
            {senseis.map((sensei) => (
              <SelectItem key={sensei.id} value={String(sensei.id)}>
                {sensei.nombre_completo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fechaNacimiento && calcularEdad(fechaNacimiento) < 18 && (
        <div className="space-y-2">
          <Label htmlFor="representante_id">{isEnglish ? "Representative *" : "Representante *"}</Label>
          <Select
            onValueChange={(value) => setValue("representante_id", value)}
            value={watch("representante_id") || ""}
          >
            <SelectTrigger>
              <SelectValue placeholder={isEnglish ? "Select representative" : "Seleccionar representante"} />
            </SelectTrigger>
            <SelectContent>
              {representantes.map((rep) => (
                <SelectItem key={rep.id} value={String(rep.id)}>
                  {[rep.nombre, rep.apellido].filter(Boolean).join(" ")} ({rep.cedula})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {fechaNacimiento && calcularEdad(fechaNacimiento) >= 18 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>{isEnglish ? "Adult:" : "Mayor de edad:"}</strong>{" "}
            {isEnglish ? "No representative required for this student." : "No se requiere representante para este alumno."}
          </p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnglish ? "Register Student" : "Registrar Alumno"}
      </Button>
    </form>
  );
}
