import { z } from "zod";
import { fechaBogotaSchema } from "./fecha";

const FUENTE_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json";

const filaPublicadaSchema = z.object({
  valor: z.string().refine((valor) => Number.isFinite(Number(valor)) && Number(valor) > 0, {
    message: "La TRM debe ser positiva.",
  }),
  unidad: z.literal("COP"),
  vigenciadesde: z.string().transform(fechaDePublicacion),
  vigenciahasta: z.string().transform(fechaDePublicacion),
}).transform((fila) => ({
  vigenteDesde: fila.vigenciadesde,
  vigenteHasta: fila.vigenciahasta,
  pesosPorDolar: Number(fila.valor),
}));

const respuestaSchema = z.array(filaPublicadaSchema);

export type TrmPublicada = z.infer<typeof filaPublicadaSchema>;

export async function leerTrmPublicada(
  desde: string,
  hasta: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TrmPublicada[]> {
  fechaBogotaSchema.parse(desde);
  fechaBogotaSchema.parse(hasta);
  const url = new URL(FUENTE_URL);
  url.searchParams.set(
    "$where",
    `vigenciadesde between '${desde}T00:00:00' and '${hasta}T00:00:00'`,
  );
  url.searchParams.set("$order", "vigenciadesde");
  url.searchParams.set("$limit", "5000");

  const respuesta = await fetchImpl(url);
  if (!respuesta.ok) throw new Error("No fue posible leer la TRM oficial.");
  return respuestaSchema.parse(await respuesta.json());
}

function fechaDePublicacion(valor: string, contexto: z.RefinementCtx): string {
  const fecha = valor.slice(0, 10);
  const resultado = fechaBogotaSchema.safeParse(fecha);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor) || !resultado.success) {
    contexto.addIssue({ code: "custom", message: "Fecha de vigencia inválida." });
    return z.NEVER;
  }
  return resultado.data;
}
