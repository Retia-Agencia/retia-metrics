import { and, eq } from "drizzle-orm";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { cuentasDelPrograma } from "@/lib/catalogo/meta";
import { plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { programs, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { claveFirmaCalendly, tokenCalendly } from "@/lib/integraciones";
import type { HechosDeConfiguracion } from "./configuracion";

export async function muestraMinimaDelPrograma(db: Db, programId: string) {
  return unaVezPorSolicitud(db, claveDe("muestraMinimaDelPrograma", programId), () =>
    db.select({ muestraMinima: programs.muestraMinimaConversion }).from(programs).where(eq(programs.id, programId)));
}

export async function hechosDeConfiguracion(
  db: Db,
  programId: string,
): Promise<HechosDeConfiguracion> {
  const [programa, token, claveFirma, fuentePrincipal, miembros, cohortes, plataformas, cuentas] =
    await Promise.all([
      unaVezPorSolicitud(db, claveDe("configuracionComercialParaHechos", programId), () => db
        .select({
          cortePagoRapidoDias: programs.cortePagoRapidoDias,
        })
        .from(programs)
        .where(eq(programs.id, programId))
        .then(([fila]) => fila)),
      tokenCalendly(db, programId),
      claveFirmaCalendly(db, programId),
      db
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.programId, programId), eq(sources.principal, true)))
        .then(([fila]) => fila),
      membresiasConCalendly(db, programId),
      listarCohortes(db, programId),
      plataformasDelPrograma(db, programId),
      cuentasDelPrograma(db, programId),
    ]);

  return {
    pagoRapidoDefinido: programa?.cortePagoRapidoDias != null,
    tieneTokenCalendly: Boolean(token),
    tieneFuentePrincipal: Boolean(fuentePrincipal),
    webhookCalendlyConectado: Boolean(claveFirma),
    miembrosActivos: miembros.length,
    tieneCohorteActiva: cohortes.some((cohorte) => cohorte.estado === "activo"),
    plataformasDePago: plataformas.length,
    cuentasMeta: cuentas.length,
  };
}
