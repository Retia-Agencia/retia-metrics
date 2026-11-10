import type { PeriodoResuelto } from "@/lib/periodo";

// 412-b: este stub lo reemplaza la integración por components/pauta/tabla-semanal.tsx (contrato de §8).

type Rango = { desde: string; hasta: string };

/** 412-b: lo reemplaza la integración. */
export async function TablaSemanalDePauta(_p: {
  programId: string; slug: string; rango: Rango; periodo: PeriodoResuelto; origen: string; hoy: string; cohorteId: string | null;
}) {
  return null;
}
