import { useState, useEffect } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const calcularEdadExacta = (fechaNac: string): number => {
  const hoy = new Date();
  const nacimiento = new Date(fechaNac);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
};

const createInscripcionSchema = (isEnglish: boolean) =>
  z
    .object({
      cedula: z
        .string()
        .min(1, isEnglish ? "ID is required" : "La cédula es requerida")
        .refine((val) => {
          if (isEnglish) {
            return /^\d{3}-?\d{2}-?\d{4}$|^\d{9}$/.test(val);
          }
          return /^[VvEeJjGgPp]-?\d{7,8}$/.test(val);
        }, isEnglish ? "Invalid ID format (e.g: 123-45-6789 or 123456789)" : "Formato de cédula inválido (ej: V-12345678 o V12345678)"),
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
        .min(1, isEnglish ? "Phone is required" : "El teléfono es requerido")
        .refine((val) => {
          if (isEnglish) {
            return /^\(\d{3}\)\s?\d{3}-?\d{4}$|^\d{3}-?\d{3}-?\d{4}$|^\d{10}$/.test(val);
          }
          return /^0\d{3}-?\d{7}$/.test(val);
        }, isEnglish ? "Invalid phone format (e.g: (555) 123-4567)" : "Formato de teléfono inválido (ej: 04121234567 o 0412-1234567)"),
      direccion: z
        .string()
        .min(10, isEnglish ? "Address must have at least 10 characters" : "La dirección debe tener al menos 10 caracteres"),
      representante_cedula: z.string().optional(),
      representante_nombre: z.string().optional(),
      representante_apellido: z.string().optional(),
      representante_telefono: z.string().optional(),
      representante_parentesco: z.string().optional(),
      nombre_padre: z.string().optional(),
      telefono_padre: z.string().optional(),
      nombre_madre: z.string().optional(),
      telefono_madre: z.string().optional(),
      contacto_emergencia: z
        .string()
        .min(2, isEnglish ? "Emergency contact must have at least 2 characters" : "El contacto de emergencia debe tener al menos 2 caracteres"),
      telefono_emergencia: z
        .string()
        .min(1, isEnglish ? "Emergency phone is required" : "El teléfono de emergencia es requerido")
        .refine((val) => {
          if (isEnglish) {
            return /^\(\d{3}\)\s?\d{3}-?\d{4}$|^\d{3}-?\d{3}-?\d{4}$|^\d{10}$/.test(val);
          }
          return /^0\d{3}-?\d{7}$/.test(val);
        }, isEnglish ? "Invalid phone format" : "Formato de teléfono inválido (ej: 04121234567)"),
    })
    .superRefine((data, ctx) => {
      if (!data.fecha_nacimiento) return;
      const edad = calcularEdadExacta(data.fecha_nacimiento);
      if (edad < 18) {
        if (!data.representante_cedula || data.representante_cedula.trim().length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["representante_cedula"],
            message: isEnglish
              ? "Legal representative ID is required for minors"
              : "La cédula real del representante es obligatoria para menores de edad",
          });
        } else if (data.representante_cedula.trim().toUpperCase() === data.cedula.trim().toUpperCase()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["representante_cedula"],
            message: isEnglish
              ? "Representative ID must be different from the student's ID"
              : "La cédula del representante debe ser distinta a la del alumno",
          });
        }

        if (!data.representante_nombre || data.representante_nombre.trim().length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["representante_nombre"],
            message: isEnglish
              ? "Representative name is required for minors"
              : "El nombre del representante es obligatorio para menores de edad",
          });
        }
      }
    });

type InscripcionFormData = z.infer<ReturnType<typeof createInscripcionSchema>>;

interface InscripcionFormProps {
  onSuccess: () => void;
}

export function InscripcionForm({ onSuccess }: InscripcionFormProps) {
  const { user } = useAuth();
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [edad, setEdad] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<string>("");
  const [montoPago, setMontoPago] = useState<number>(0);
  const [costoInscripcion, setCostoInscripcion] = useState<number>(15);
  const [categoriasCatalogo, setCategoriasCatalogo] = useState<any[]>([]);
  const [cintasCatalogo, setCintasCatalogo] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InscripcionFormData>({
    resolver: zodResolver(createInscripcionSchema(isEnglish)),
    defaultValues: {
      representante_parentesco: "Padre/Madre",
    },
  });

  const fechaNacimiento = watch("fecha_nacimiento");

  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const [cats, cintas, configPagos] = await Promise.all([
          apiClient.getCategoriasEdad(),
          apiClient.getCintas(),
          apiClient.getConfigPagos().catch(() => null),
        ]);
        setCategoriasCatalogo(cats || []);
        setCintasCatalogo(cintas || []);
        if (configPagos?.costo_inscripcion !== undefined) {
          setCostoInscripcion(Number(configPagos.costo_inscripcion) || 15);
        }
      } catch (err) {
        console.error("Error cargando catálogos de inscripción:", err);
      }
    };
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (fechaNacimiento) {
      calcularEdadYCategoria(fechaNacimiento);
    }
  }, [fechaNacimiento, categoriasCatalogo, costoInscripcion]);

  const resolverCategoriaPorEdad = (edadCalculada: number, catalogo: any[]) => {
    const exacta = catalogo.find(
      (cat: any) =>
        edadCalculada >= (cat.edad_min ?? 0) && edadCalculada <= (cat.edad_max ?? 150)
    );
    if (exacta) return exacta;

    // Rangos canónicos alineados con el sistema de niveles del Dojo
    let nombreFallback = "Senior";
    if (edadCalculada <= 8) nombreFallback = "Benjamín";
    else if (edadCalculada <= 10) nombreFallback = "Alevín";
    else if (edadCalculada <= 12) nombreFallback = "Infantil";
    else if (edadCalculada <= 15) nombreFallback = "Cadete";
    else if (edadCalculada <= 17) nombreFallback = "Junior";
    else if (edadCalculada <= 34) nombreFallback = "Senior";
    else nombreFallback = "Veterano";

    return (
      catalogo.find((cat: any) =>
        cat.nombre?.toLowerCase().includes(nombreFallback.toLowerCase())
      ) || { id: null, nombre: nombreFallback, precio_mensualidad: 50 }
    );
  };

  const calcularEdadYCategoria = (fechaNac: string) => {
    const edadCalculada = calcularEdadExacta(fechaNac);
    setEdad(edadCalculada);

    const catEncontrada = resolverCategoriaPorEdad(edadCalculada, categoriasCatalogo);
    setCategoria(catEncontrada?.nombre || "");
    const precioMensualidad = Number(catEncontrada?.precio_mensualidad ?? 50);
    setMontoPago(precioMensualidad + costoInscripcion);
  };

  const onSubmit = async (data: InscripcionFormData) => {
    setLoading(true);
    try {
      const edadCalculada = calcularEdadExacta(data.fecha_nacimiento);
      const categoriasEdad = categoriasCatalogo.length > 0
        ? categoriasCatalogo
        : await apiClient.getCategoriasEdad();
      const cintas = cintasCatalogo.length > 0
        ? cintasCatalogo
        : await apiClient.getCintas();

      const categoriaEncontrada = resolverCategoriaPorEdad(edadCalculada, categoriasEdad);
      const cintaInicial =
        cintas.find(
          (c: any) =>
            c.orden === 1 ||
            /blanco|white/i.test(c.nombre || "") ||
            /white/i.test(c.nombre_en || "")
        ) || cintas[0];

      const datosAlumno: Record<string, any> = {
        cedula: data.cedula.trim(),
        nombre: user?.nombre_completo || "",
        fecha_nacimiento: data.fecha_nacimiento,
        telefono: data.telefono,
        email: user?.email || "",
        direccion: data.direccion,
        id_categoria_edad: categoriaEncontrada?.id || null,
        id_cinta: cintaInicial?.id || null,
        usuario_id: user?.id,
        contacto_emergencia: data.contacto_emergencia,
        telefono_emergencia: data.telefono_emergencia,
        nombre_padre: data.nombre_padre || null,
        telefono_padre: data.telefono_padre || null,
        nombre_madre: data.nombre_madre || null,
        telefono_madre: data.telefono_madre || null,
      };

      if (edadCalculada < 18 && data.representante_cedula && data.representante_nombre) {
        datosAlumno.representante_data = {
          cedula: data.representante_cedula.trim(),
          nombre: data.representante_nombre.trim(),
          apellido: data.representante_apellido?.trim() || null,
          telefono: data.representante_telefono?.trim() || data.telefono_emergencia || null,
          parentesco: data.representante_parentesco || "Representante Legal",
        };
      }

      await apiClient.createAlumno(datosAlumno);

      toast({
        title: isEnglish ? "Registration completed!" : "¡Inscripción completada!",
        description: isEnglish
          ? `Now you must make the payment of $${Number(montoPago).toFixed(2)} (Monthly + Registration)`
          : `Ahora debes realizar el pago de $${Number(montoPago).toFixed(2)} (Mensualidad + Inscripción)`,
      });

      onSuccess();
    } catch (error: any) {
      const errorMessage =
        error.data?.error ||
        error.data?.message ||
        error.message ||
        (isEnglish ? "Could not complete registration" : "No se pudo completar la inscripción");

      toast({
        title: isEnglish ? "Error" : "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          📋 {isEnglish ? "Important Information" : "Información Importante"}
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {isEnglish ? "Complete this form to register in the dojo. Registration payment is" : "Complete este formulario para inscribirse en el dojo. El pago de inscripción es de"} <strong>$15</strong> {isEnglish ? "additional to the first monthly payment." : "adicional a la primera mensualidad."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cedula">{isEnglish ? "ID *" : "Cédula *"}</Label>
          <Input 
            id="cedula" 
            {...register("cedula")} 
            placeholder={isEnglish ? "123-45-6789" : "V-12345678"}
            pattern={isEnglish ? "\\d{3}-?\\d{2}-?\\d{4}|\\d{9}" : "[VvEeJjGgPp]-?\\d{7,8}"}
            title={isEnglish ? "Format: 123-45-6789 or 123456789 (9 digits)" : "Formato: V-12345678 o V12345678 (V, E, J, G o P seguido de 7-8 dígitos)"}
          />
          {errors.cedula && (
            <p className="text-sm text-destructive">{errors.cedula.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecha_nacimiento">{isEnglish ? "Birth Date *" : "Fecha de Nacimiento *"}</Label>
          <Input 
            id="fecha_nacimiento" 
            type="date" 
            {...register("fecha_nacimiento")}
            min="1935-01-01"
            max={new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0]}
            title="Fecha entre 1935 y el año pasado"
          />
          {errors.fecha_nacimiento && (
            <p className="text-sm text-destructive">{errors.fecha_nacimiento.message}</p>
          )}
        </div>
      </div>

      {edad !== null && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm">
            <span className="font-semibold">{isEnglish ? "Age:" : "Edad:"}</span> {edad} {isEnglish ? "years" : "años"} |{' '}
            <span className="font-semibold">{isEnglish ? "Category:" : "Categoría:"}</span> {categoria} |{' '}
            <span className="font-semibold">{isEnglish ? "Total Payment:" : "Pago Total:"}</span> ${Number(montoPago).toFixed(2)} (${Number(montoPago - 15).toFixed(2)} {isEnglish ? "monthly" : "mensualidad"} + $15.00 {isEnglish ? "registration" : "inscripción"})
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="telefono">{isEnglish ? "Phone *" : "Teléfono *"}</Label>
          <Input 
            id="telefono" 
            {...register("telefono")} 
            placeholder={isEnglish ? "(555) 123-4567" : "04121234567"}
            pattern={isEnglish ? "\\(\\d{3}\\)\\s?\\d{3}-?\\d{4}|\\d{3}-?\\d{3}-?\\d{4}|\\d{10}" : "0\\d{3}-?\\d{7}"}
            title={isEnglish ? "Format: (555) 123-4567 or 555-123-4567" : "Formato: 04121234567 o 0412-1234567 (11 dígitos comenzando con 0)"}
            inputMode="numeric"
          />
          {errors.telefono && (
            <p className="text-sm text-destructive">{errors.telefono.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="direccion">{isEnglish ? "Address *" : "Dirección *"}</Label>
          <Input 
            id="direccion" 
            {...register("direccion")} 
            placeholder={isEnglish ? "Ex: 123 Main St, Apt 2B, City, State 12345" : "Ej: Av. Principal, Edificio ABC, Piso 2, Apartamento 3"}
            minLength={10}
            title={isEnglish ? "Minimum 10 characters" : "Mínimo 10 caracteres"}
          />
          {errors.direccion && (
            <p className="text-sm text-destructive">{errors.direccion.message}</p>
          )}
        </div>
      </div>

      {edad !== null && edad < 18 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-amber-900 dark:text-amber-200">
            {isEnglish ? "Legal Representative (Required for Minors) *" : "Representante Legal (Obligatorio para menores de 18 años) *"}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="representante_cedula">{isEnglish ? "Representative ID *" : "Cédula del Representante *"}</Label>
              <Input
                id="representante_cedula"
                {...register("representante_cedula")}
                placeholder={isEnglish ? "123-45-6789" : "V-12345678"}
              />
              {errors.representante_cedula && (
                <p className="text-sm text-destructive">{errors.representante_cedula.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="representante_parentesco">{isEnglish ? "Relationship" : "Parentesco"}</Label>
              <Select
                value={watch("representante_parentesco") || "Padre/Madre"}
                onValueChange={(val) => setValue("representante_parentesco", val)}
              >
                <SelectTrigger id="representante_parentesco">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Padre">{isEnglish ? "Father" : "Padre"}</SelectItem>
                  <SelectItem value="Madre">{isEnglish ? "Mother" : "Madre"}</SelectItem>
                  <SelectItem value="Padre/Madre">{isEnglish ? "Parent" : "Padre/Madre"}</SelectItem>
                  <SelectItem value="Tutor Legal">{isEnglish ? "Legal Guardian" : "Tutor Legal"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="representante_nombre">{isEnglish ? "First Name *" : "Nombre *"}</Label>
              <Input id="representante_nombre" {...register("representante_nombre")} placeholder={isEnglish ? "First name" : "Nombre"} />
              {errors.representante_nombre && (
                <p className="text-sm text-destructive">{errors.representante_nombre.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="representante_apellido">{isEnglish ? "Last Name" : "Apellido"}</Label>
              <Input id="representante_apellido" {...register("representante_apellido")} placeholder={isEnglish ? "Last name" : "Apellido"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representante_telefono">{isEnglish ? "Phone" : "Teléfono"}</Label>
              <Input id="representante_telefono" {...register("representante_telefono")} placeholder={isEnglish ? "(555) 123-4567" : "04121234567"} />
            </div>
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">{isEnglish ? "Parents Information (Optional)" : "Información de Padres (Opcional)"}</h4>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="space-y-2">
            <Label htmlFor="nombre_padre">{isEnglish ? "Father's Name" : "Nombre del Padre"}</Label>
            <Input id="nombre_padre" {...register("nombre_padre")} placeholder={isEnglish ? "Full name" : "Nombre completo"} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_padre">{isEnglish ? "Father's Phone" : "Teléfono del Padre"}</Label>
            <Input 
              id="telefono_padre" 
              {...register("telefono_padre")} 
              placeholder={isEnglish ? "(555) 123-4567" : "04121234567"}
              pattern={isEnglish ? "\\(\\d{3}\\)\\s?\\d{3}-?\\d{4}|\\d{3}-?\\d{3}-?\\d{4}|\\d{10}" : "0\\d{3}-?\\d{7}"}
              title={isEnglish ? "Format: (555) 123-4567 or 555-123-4567" : "Formato: 04121234567 o 0412-1234567 (11 dígitos comenzando con 0)"}
              inputMode="numeric"
            />
            {errors.telefono_padre && (
              <p className="text-sm text-destructive">{errors.telefono_padre.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_madre">{isEnglish ? "Mother's Name" : "Nombre de la Madre"}</Label>
            <Input id="nombre_madre" {...register("nombre_madre")} placeholder={isEnglish ? "Full name" : "Nombre completo"} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_madre">{isEnglish ? "Mother's Phone" : "Teléfono de la Madre"}</Label>
            <Input 
              id="telefono_madre" 
              {...register("telefono_madre")} 
              placeholder={isEnglish ? "(555) 123-4567" : "04121234567"}
              pattern={isEnglish ? "\\(\\d{3}\\)\\s?\\d{3}-?\\d{4}|\\d{3}-?\\d{3}-?\\d{4}|\\d{10}" : "0\\d{3}-?\\d{7}"}
              title={isEnglish ? "Format: (555) 123-4567 or 555-123-4567" : "Formato: 04121234567 o 0412-1234567 (11 dígitos comenzando con 0)"}
              inputMode="numeric"
            />
            {errors.telefono_madre && (
              <p className="text-sm text-destructive">{errors.telefono_madre.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">{isEnglish ? "Emergency Contact *" : "Contacto de Emergencia *"}</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contacto_emergencia">{isEnglish ? "Contact Name *" : "Nombre del Contacto *"}</Label>
            <Input 
              id="contacto_emergencia" 
              {...register("contacto_emergencia")} 
              placeholder={isEnglish ? "Ex: Maria Gonzalez" : "Ej: María González"}
              minLength={2}
              title={isEnglish ? "Minimum 2 characters" : "Mínimo 2 caracteres"}
            />
            {errors.contacto_emergencia && (
              <p className="text-sm text-destructive">{errors.contacto_emergencia.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono_emergencia">{isEnglish ? "Emergency Phone *" : "Teléfono de Emergencia *"}</Label>
            <Input 
              id="telefono_emergencia" 
              {...register("telefono_emergencia")} 
              placeholder={isEnglish ? "(555) 123-4567" : "04121234567"}
              pattern={isEnglish ? "\\(\\d{3}\\)\\s?\\d{3}-?\\d{4}|\\d{3}-?\\d{3}-?\\d{4}|\\d{10}" : "0\\d{3}-?\\d{7}"}
              title={isEnglish ? "Format: (555) 123-4567 or 555-123-4567" : "Formato: 04121234567 o 0412-1234567 (11 dígitos comenzando con 0)"}
              inputMode="numeric"
            />
            {errors.telefono_emergencia && (
              <p className="text-sm text-destructive">{errors.telefono_emergencia.message}</p>
            )}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading || !edad}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
{isEnglish ? "Complete Registration" : "Completar Inscripción"}
      </Button>
    </form>
  );
}

