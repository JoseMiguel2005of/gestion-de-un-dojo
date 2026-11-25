import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useLanguage, translateBelt } from "@/hooks/useLanguage";
import { CINTAS_CANONICAS } from "./NivelForm";

const nivelEditSchema = z
  .object({
    nombre: z.string().min(2, "El nombre es requerido"),
    edad_min: z.coerce.number().int().min(0, "Edad mínima inválida"),
    edad_max: z.coerce.number().int().min(0, "Edad máxima inválida"),
    cinta_maxima: z.string().optional(),
    precio_mensualidad: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
    orden: z.coerce.number().int().min(1).default(99),
  })
  .refine((d) => d.edad_max >= d.edad_min, {
    path: ["edad_max"],
    message: "La edad máxima debe ser mayor o igual a la edad mínima",
  });

type NivelEditFormData = z.infer<typeof nivelEditSchema>;

interface NivelEditFormProps {
  nivelId: string;
  onSuccess: () => void;
}

export function NivelEditForm({ nivelId, onSuccess }: NivelEditFormProps) {
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<NivelEditFormData>({
    resolver: zodResolver(nivelEditSchema),
  });

  const selectedCintaMax = watch("cinta_maxima");

  useEffect(() => {
    const fetchCategoria = async () => {
      try {
        const data = await apiClient.getCategoriaEdad(nivelId);
        if (data) {
          setValue("nombre", data.nombre || "");
          setValue("edad_min", Number(data.edad_min ?? 6));
          setValue("edad_max", Number(data.edad_max ?? 99));
          setValue("cinta_maxima", data.cinta_maxima || "Negro");
          setValue("precio_mensualidad", Number(data.precio_mensualidad ?? 50));
          setValue("orden", Number(data.orden ?? 99));
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos de la categoría",
          variant: "destructive",
        });
      }
    };
    fetchCategoria();
  }, [nivelId, setValue]);

  const onSubmit = async (data: NivelEditFormData) => {
    setLoading(true);
    try {
      await apiClient.updateCategoriaEdad(nivelId, {
        nombre: data.nombre,
        edad_min: data.edad_min,
        edad_max: data.edad_max,
        cinta_maxima: data.cinta_maxima || null,
        precio_mensualidad: data.precio_mensualidad,
        orden: data.orden,
      });

      toast({
        title: isEnglish ? "Success" : "Éxito",
        description: isEnglish ? "Category updated successfully" : "Categoría actualizada correctamente",
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
        <Label htmlFor="edit-nombre">{isEnglish ? "Category Name *" : "Nombre de la Categoría *"}</Label>
        <Input id="edit-nombre" {...register("nombre")} />
        {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-edad-min">{isEnglish ? "Minimum Age *" : "Edad Mínima *"}</Label>
          <Input id="edit-edad-min" type="number" min="0" max="100" {...register("edad_min")} />
          {errors.edad_min && <p className="text-sm text-destructive">{errors.edad_min.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-edad-max">{isEnglish ? "Maximum Age *" : "Edad Máxima *"}</Label>
          <Input id="edit-edad-max" type="number" min="0" max="120" {...register("edad_max")} />
          {errors.edad_max && <p className="text-sm text-destructive">{errors.edad_max.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isEnglish ? "Maximum Allowed Belt" : "Cinta Máxima Permitida"}</Label>
          <Select
            value={selectedCintaMax || "Negro"}
            onValueChange={(val) => setValue("cinta_maxima", val)}
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
          <Label htmlFor="edit-precio">{isEnglish ? "Monthly Fee (USD$) *" : "Mensualidad (USD$) *"}</Label>
          <Input id="edit-precio" type="number" step="0.01" min="0" {...register("precio_mensualidad")} />
          {errors.precio_mensualidad && (
            <p className="text-sm text-destructive">{errors.precio_mensualidad.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnglish ? "Update Category" : "Actualizar Categoría"}
      </Button>
    </form>
  );
}
