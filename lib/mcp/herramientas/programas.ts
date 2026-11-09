import { z } from "zod";
import { programasVisibles } from "@/lib/auth/alcance";
import { salidaDeProgramasVisibles } from "@/lib/mcp/salidas/programas";
import type { Herramienta } from "./tipos";

const entrada = z.object({}).strict();

export const programasVisiblesMcp: Herramienta<typeof entrada> = {
  nombre: "programas_visibles",
  titulo: "Programas visibles",
  descripcion:
    "Úsala cuando no sepas qué programa consultar o necesites su identificador. Devuelve los programas activos que puede consultar la persona actual, con nombre y slug. " +
    "No mezcla cifras ni devuelve métricas. Usa el slug en herramientas posteriores. " +
    "Las fechas de esas herramientas se interpretan en Bogotá y cada monto incluye su moneda; " +
    "cuando una lista sea paginada, su respuesta indicará cómo pedir la página siguiente.",
  entrada,
  salida: salidaDeProgramasVisibles,
  puede: () => true,
  soloLectura: true,
  async ejecutar(contexto) {
    const programas = (await programasVisibles(
      contexto.session.user.id,
      contexto.rol,
      contexto.db,
    )).map(({ nombre, slug }) => ({ nombre, slug }));
    const texto = programas.length === 0
      ? "No hay programas visibles."
      : programas.map((programa) => `- ${programa.nombre} (${programa.slug})`).join("\n");
    return { texto, estructurado: { programas } };
  },
};
