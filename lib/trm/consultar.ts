import { and, asc, desc, gte, lte } from "drizzle-orm";
import { tasasCambio } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fecha, num } from "@/lib/format";
import { desplazarFecha, fechaBogotaSchema } from "./fecha";

export type TasaDelDia = {
  fecha: string;
  pesosPorDolar: number;
  vigenteDesde: string;
  etiqueta: string;
};

export async function tasaDelDia(db: Db, dia: string): Promise<TasaDelDia | null> {
  fechaBogotaSchema.parse(dia);
  const [fila] = await db.select({
    vigenteDesde: tasasCambio.vigenteDesde,
    pesosPorDolar: tasasCambio.pesosPorDolar,
  }).from(tasasCambio).where(and(
    lte(tasasCambio.vigenteDesde, dia),
    gte(tasasCambio.vigenteHasta, dia),
  )).orderBy(desc(tasasCambio.vigenteDesde)).limit(1);
  if (!fila) return null;
  const valor = Number(fila.pesosPorDolar);
  return {
    fecha: dia,
    pesosPorDolar: valor,
    vigenteDesde: fila.vigenteDesde,
    etiqueta: etiquetaUnica(valor, fila.vigenteDesde),
  };
}

export async function tasasDelRango(
  db: Db,
  desde: string,
  hasta: string,
): Promise<{ porDia: Map<string, number>; faltantes: string[]; etiqueta: string | null }> {
  fechaBogotaSchema.parse(desde);
  fechaBogotaSchema.parse(hasta);
  const filas = await db.select({
    vigenteDesde: tasasCambio.vigenteDesde,
    vigenteHasta: tasasCambio.vigenteHasta,
    pesosPorDolar: tasasCambio.pesosPorDolar,
  }).from(tasasCambio).where(and(
    lte(tasasCambio.vigenteDesde, hasta),
    gte(tasasCambio.vigenteHasta, desde),
  )).orderBy(asc(tasasCambio.vigenteDesde));

  const porDia = new Map<string, number>();
  const faltantes: string[] = [];
  const publicacionesUsadas = new Map<string, { valor: number; vigenteDesde: string }>();
  for (let dia = desde; dia <= hasta; dia = desplazarFecha(dia, 1)) {
    const fila = filas.find((candidata) => candidata.vigenteDesde <= dia && dia <= candidata.vigenteHasta);
    if (!fila) {
      faltantes.push(dia);
      continue;
    }
    const valor = Number(fila.pesosPorDolar);
    porDia.set(dia, valor);
    publicacionesUsadas.set(fila.vigenteDesde, { valor, vigenteDesde: fila.vigenteDesde });
  }

  const publicaciones = [...publicacionesUsadas.values()];
  const valores = [...new Set(publicaciones.map((publicacion) => publicacion.valor))];
  let etiqueta: string | null = null;
  if (valores.length === 1) {
    etiqueta = etiquetaUnica(valores[0], publicaciones[0].vigenteDesde);
  } else if (valores.length > 1) {
    etiqueta = `TRM ${num(Math.min(...valores))} a ${num(Math.max(...valores))}`;
  }
  return { porDia, faltantes, etiqueta };
}

function etiquetaUnica(valor: number, vigenteDesde: string): string {
  return `TRM ${num(valor)} (${fecha(vigenteDesde)})`;
}
