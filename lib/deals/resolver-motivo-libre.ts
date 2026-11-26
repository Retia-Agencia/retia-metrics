import { and, eq, sql } from "drizzle-orm";
import { motivos as catalogoDeMotivos } from "@/lib/catalogo/motivos";
import { crearConRastro } from "@/lib/crm/rastro";
import { dealActividades, motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { TipoMotivo } from "./etapas";

export interface MotivoLibre {
  texto: string;
  guardarComoOpcion: boolean;
}

interface EntradaResolverMotivoLibre {
  motivoLibre: MotivoLibre;
  tipo: TipoMotivo;
  actorUserId: string;
  dealId: string;
  etiqueta: string | null;
}

/**
 * Convierte el texto escrito durante un movimiento en un motivo del catálogo. Es la
 * excepción nombrada que permite al closer crear opciones sin administrar el catálogo:
 * toda escritura sigue pasando por el molde y conserva actor y rastro.
 */
export async function resolverMotivoLibre(
  db: Db,
  entrada: EntradaResolverMotivoLibre,
): Promise<string> {
  const texto = entrada.motivoLibre.texto.trim();
  if (!texto) throw new ErrorDeApp("Escribe el motivo.", 422);
  if (texto.length > 80) throw new ErrorDeApp("El motivo no puede superar 80 caracteres.", 422);

  const nombre = entrada.motivoLibre.guardarComoOpcion ? texto : "Otro";
  const [existente] = await db
    .select()
    .from(motivos)
    .where(and(eq(motivos.tipo, entrada.tipo), sql`lower(${motivos.nombre}) = lower(${nombre})`));
  const catalogo = catalogoDeMotivos(db);

  let motivoId = existente?.id;
  if (!existente) {
    const creado = await catalogo.crear(entrada.actorUserId, {
      nombre,
      tipo: entrada.tipo,
      pideTexto: !entrada.motivoLibre.guardarComoOpcion,
    });
    motivoId = creado.id;
  } else {
    if (!existente.activo) await catalogo.reactivar(entrada.actorUserId, existente.id);
    if (!entrada.motivoLibre.guardarComoOpcion && !existente.pideTexto) {
      await catalogo.editar(entrada.actorUserId, existente.id, {
        nombre: existente.nombre,
        tipo: existente.tipo,
        pideTexto: true,
      });
    }
  }

  if (!entrada.motivoLibre.guardarComoOpcion) {
    await crearConRastro(
      {
        db,
        tabla: dealActividades,
        nombreTabla: "deal_actividades",
        actorId: entrada.actorUserId,
        etiqueta: entrada.etiqueta ?? entrada.dealId,
      },
      {
        dealId: entrada.dealId,
        tipo: "nota",
        canal: null,
        userId: entrada.actorUserId,
        fecha: new Date(),
        nota: texto,
      },
    );
  }

  return motivoId!;
}
