import type { PeriodoResuelto } from "@/lib/periodo";

// 412-b / 412-c / 412-e: estos tres stubs los reemplaza la integración por los componentes reales
// (components/pauta/tabla-semanal.tsx, cumplimiento.tsx y traza.tsx). Mismas props que el contrato de §8.

type Rango = { desde: string; hasta: string };

/** 412-b: lo reemplaza la integración. */
export async function TablaSemanalDePauta(_p: {
  programId: string; slug: string; rango: Rango; periodo: PeriodoResuelto; origen: string; hoy: string; cohorteId: string | null;
}) {
  return null;
}

/** 412-c: lo reemplaza la integración. */
export async function CumplimientoDeCohorte(_p: { programId: string; slug: string; cohorteId: string | null; hoy: string }) {
  return null;
}

/** 412-e: lo reemplaza la integración. */
export async function TrazaDePauta(_p: { programId: string; slug: string; rango: Rango; periodo: PeriodoResuelto; origen: string }) {
  return null;
}
