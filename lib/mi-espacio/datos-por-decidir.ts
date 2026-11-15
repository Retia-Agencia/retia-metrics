import type { Db } from "@/lib/db/tipos";
import { llamadasSinCloserDelPrograma, llamadasSueltasDelPrograma } from "@/lib/queries/inbox";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";

export async function cargarDatosDePorDecidir(db: Db, programId: string) {
  const [secciones, llamadasSueltas, llamadasSinCloser, salud] = await Promise.all([
    seccionesSinDueno(db, programId),
    llamadasSueltasDelPrograma(db, programId),
    llamadasSinCloserDelPrograma(db, programId),
    saludDeFuentes(db),
  ]);
  return { secciones, llamadasSueltas, llamadasSinCloser, salud };
}

export type DatosDePorDecidir = Awaited<ReturnType<typeof cargarDatosDePorDecidir>>;
