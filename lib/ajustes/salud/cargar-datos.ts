import { eq } from "drizzle-orm";
import { auditarCalendly } from "@/lib/calendly/auditoria";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { saludDeGrain } from "@/lib/grain/transcripciones";
import { elegirPrograma } from "@/lib/programa-preferido";
import { conciliarProgramaConHoja } from "@/lib/queries/conciliacion-sheets";
import { entregasDePrograma, entregasHuerfanas } from "@/lib/queries/entregas-webhook";
import { origenDelPrograma } from "@/lib/queries/origen";
import { programasActivos } from "@/lib/queries/programas";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";

type FetchDeCalendly = NonNullable<Parameters<typeof auditarCalendly>[2]>["fetch"];

export async function cargarDatosDeSalud(db: Db, entrada: {
  slugPedido?: string;
  programaPreferido?: string | null;
  hoy: string;
  ahora: Date;
  fetchCalendly?: FetchDeCalendly;
}) {
  const programas = await programasActivos(db);
  if (programas.length === 0) return { programas, programa: null } as const;
  const programa = programas.find((fila) => fila.slug === entrada.slugPedido) ?? elegirPrograma(programas, entrada.programaPreferido ?? null)!;
  const [paginaEntregas, paginaHuerfanas, salud, conciliacion, calendlyPrograma, grain] = await Promise.all([
    entregasDePrograma(programa.id, null, db),
    entregasHuerfanas(null, db),
    saludDeFuentes(db, entrada.ahora),
    conciliarProgramaConHoja(programa.id, db),
    db.select({ orgCompartida: programs.calendlyOrgCompartida, eventType: programs.calendlyEventType }).from(programs).where(eq(programs.id, programa.id)).then((filas) => filas[0] ?? { orgCompartida: false, eventType: null }),
    saludDeGrain(db, programa.id),
  ]);
  const [auditoriaCalendly, vistaDeOrigen] = await Promise.all([
    auditarCalendly(db, programa.id, { fetch: entrada.fetchCalendly, ahora: entrada.ahora }),
    origenDelPrograma(db, { programId: programa.id, rango: { desde: entrada.hoy, hasta: entrada.hoy }, hoy: entrada.hoy }),
  ]);
  return { programas, programa, paginaEntregas, paginaHuerfanas, salud, conciliacion, calendlyPrograma, grain, auditoriaCalendly, vistaDeOrigen } as const;
}
