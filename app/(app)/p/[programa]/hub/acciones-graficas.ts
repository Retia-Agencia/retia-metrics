"use server";

import { z } from "zod";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireSessionDeLectura } from "@/lib/auth/guards";
import { AuthorizationError, esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { hoyEnBogota } from "@/lib/format";
import { detalleDeCifra } from "@/lib/queries/vista-metrica";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entrada = z.object({
  slug: z.string().min(1).max(200),
  metrica: z.enum(["cierres", "caja"]),
  desde: dia,
  hasta: dia,
  cohorteId: z.string().min(1).max(200).nullable(),
  claveCloser: z.string().min(1).max(300).nullable(),
  origen: z.string().min(1).max(2_000).startsWith("/"),
}).refine((valor) => valor.desde <= valor.hasta, { message: "Periodo inválido." });

export type EntradaDetalleDePunto = z.input<typeof entrada>;

/** Lectura bajo demanda del mismo resumen que abre una cifra del Hub. */
export async function detalleDePuntoAccion(input: EntradaDetalleDePunto) {
  const validado = entrada.parse(input);
  const session = await requireSessionDeLectura();
  const rol = await rolDeVista(session);
  // La misma capacidad que la lista de "cierres" y "caja" (hub/lista/page.tsx): quien administra.
  if (!esAdministrador(rol)) throw new AuthorizationError();
  const programa = await programaVisiblePorSlug(session.user.id, rol, validado.slug);
  if (!programa) throw new AuthorizationError();
  return detalleDeCifra(validado.metrica, {
    programId: programa.id,
    slug: programa.slug,
    hoy: hoyEnBogota(),
    periodo: { preset: "custom", a: { desde: validado.desde, hasta: validado.hasta }, b: null },
    claveCloser: validado.claveCloser,
    cohorteId: validado.cohorteId,
    origen: validado.origen,
  });
}
