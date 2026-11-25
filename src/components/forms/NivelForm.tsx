import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage, translateBelt } from "@/hooks/useLanguage";

export const CATEGORIAS_PREDEFINIDAS: Record<
  string,
  { labelEn: string; edad_min: number; edad_max: number; cinta_maxima: string; orden: number }
> = {
  "Benjamín": { labelEn: "Benjamin", edad_min: 6, edad_max: 8, cinta_maxima: "Verde", orden: 1 },
  "Alevín": { labelEn: "Alevin", edad_min: 9, edad_max: 10, cinta_maxima: "Azul", orden: 2 },
  "Infantil": { labelEn: "Infant", edad_min: 11, edad_max: 12, cinta_maxima: "Azul", orden: 3 },
  "Cadete": { labelEn: "Cadet", edad_min: 13, edad_max: 15, cinta_maxima: "Marrón", orden: 4 },
  "Junior": { labelEn: "Junior", edad_min: 16, edad_max: 17, cinta_maxima: "Negro", orden: 5 },
  "Senior": { labelEn: "Senior", edad_min: 18, edad_max: 34, cinta_maxima: "Negro", orden: 6 },
  "Veterano": { labelEn: "Veteran", edad_min: 35, edad_max: 99, cinta_maxima: "Negro", orden: 7 },
};

export const CINTAS_CANONICAS = [
  { nombre: "Blanco", color_hex: "#FFFFFF" },
  { nombre: "Amarillo", color_hex: "#FACC15" },
  { nombre: "Naranja", color_hex: "#FB923C" },
  { nombre: "Verde", color_hex: "#22C55E" },
  { nombre: "Azul", color_hex: "#2563EB" },
  { nombre: "Marrón", color_hex: "#78350F" },
  { nombre: "Negro", color_hex: "#18181B" },
];

const createNivelSchema = (isEnglish: boolean) =>
  z
    .object({
      nombre: z.string().min(2, isEnglish ? "Category name is required" : "El nombre es requerido"),
      edad_min: z.coerce.number().int().min(0, isEnglish ? "Minimum age >= 0" : "Edad mínima >= 0"),
      edad_max: z.coerce.number().int().min(0, isEnglish ? "Maximum age >= 0" : "Edad máxima >= 0"),
      cinta_maxima: z.string().optional(),
      precio_mensualidad: z.coerce.number().min(0, isEnglish ? "Price >= 0" : "Precio >= 0"),
      orden: z.coerce.number().int().min(1).default(99),
    })
    .refine((d) => d.edad_max >= d.edad_min, {
      path: ["edad_max"],
      message: isEnglish
        ? "Maximum age must be greater than or equal to minimum age"
        : "La edad máxima debe ser mayor o igual a la mínima",
    });

type NivelFormData = z.infer<ReturnType<typeof createNivelSchema>>;

interface NivelFormProps {
  onSuccess: () => void;
}

export function NivelForm({ onSuccess }: NivelFormProps) {
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NivelFormData>({
    resolver: zodResolver(createNivelSchema(isEnglish)),
    defaultValues: {
      edad_min: 6,
      edad_max: 17,
      cinta_maxima: "Negro",
      precio_mensualidad: 50,
      orden: 1,
    },
  });

  const selectedNombre = watch("nombre");
  const selectedCintaMax = watch("cinta_maxima");

  const handleSelectPreset = (canonicalKey: string) => {
    setValue("nombre", canonicalKey, { shouldValidate: true });
    const preset = CATEGORIAS_PREDEFINIDAS[canonicalKey];
    if (preset) {
      setValue("edad_min", preset.edad_min);
      setValue("edad_max", preset.edad_max);
      setValue("cinta_maxima", preset.cinta_maxima);
      setValue("orden", preset.orden);
    }
  };

  const onSubmit = async (data: NivelFormData) => {
    setLoading(true);
    try {
      await apiClient.createCategoriaEdad({
        nombre: data.nombre,
        edad_min: data.edad_min,
        edad_max: data.edad_max,
        cinta_maxima: data.cinta_maxima || null,
        precio_mensualidad: data.precio_mensualidad,
        orden: data.orden,
      });

      toast({
        title: isEnglish ? "Category created" : "Categoría creada",
        description: isEnglish
          ? "Age category registered successfully"
          : "La categoría de edad se creó correctamente",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: isEnglish ? "Error" : "Error",
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
        <Label>{isEnglish ? "Preset Category (or type below)" : "Plantilla de Categoría (o escribe abajo)"}</Label>
        <Select onValueChange={handleSelectPreset} value={CATEGORIAS_PREDEFINIDAS[selectedNombre] ? selectedNombre : ""}>
          <SelectTrigger>
            <SelectValue placeholder={isEnglish ? "Choose official Judo category..." : "Elegir categoría oficial..."} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIAS_PREDEFINIDAS).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {isEnglish ? meta.labelEn : key} ({meta.edad_min}-{meta.edad_max} {isEnglish ? "yrs" : "años"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombre">{isEnglish ? "Category Name *" : "Nombre de la Categoría *"}</Label>
        <Input id="nombre" {...register("nombre")} placeholder="Ej: Benjamín, Junior, Senior..." />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edad_min">{isEnglish ? "Minimum Age *" : "Edad Mínima *"}</Label>
          <Input id="edad_min" type="number" min="0" max="100" {...register("edad_min")} />
          {errors.edad_min && <p className="text-sm text-destructive">{errors.edad_min.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edad_max">{isEnglish ? "Maximum Age *" : "Edad Máxima *"}</Label>
          <Input id="edad_max" type="number" min="0" max="120" {...register("edad_max")} />
          {errors.edad_max && <p className="text-sm text-destructive">{errors.edad_max.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isEnglish ? "Maximum Allowed Belt" : "Cinta Máxima Permitida"}</Label>
          <Select
            value={selectedCintaMax || "Negro"}
            onValueChange={(value) => setValue("cinta_maxima", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CINTAS_CANONICAS.map((cinta) => (
                <SelectItem key={cinta.nombre} value={cinta.nombre}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded border"
                      style={{ backgroundColor: cinta.color_hex }}
                    />
                    <span>{translateBelt(cinta.nombre, isEnglish)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="precio_mensualidad">
            {isEnglish ? "Monthly Fee (USD$) *" : "Mensualidad (USD$) *"}
          </Label>
          <Input
            id="precio_mensualidad"
            type="number"
            step="0.01"
            min="0"
            {...register("precio_mensualidad")}
          />
          {errors.precio_mensualidad && (
            <p className="text-sm text-destructive">{errors.precio_mensualidad.message}</p>
          )}
        </div>
      </div>

      {selectedNombre && selectedCintaMax && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {isEnglish ? "Students in" : "Los alumnos en"} <strong>{selectedNombre}</strong>{" "}
            {isEnglish ? "can advance up to belt" : "podrán ascender hasta cinta"}{" "}
            <strong>{translateBelt(selectedCintaMax, isEnglish)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnglish ? "Save Category" : "Guardar Categoría"}
      </Button>
    </form>
  );
}
