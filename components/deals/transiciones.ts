import type { EtapaDeal, PendienteDeal, QuienMueve, TipoMotivo } from "@/lib/deals/etapas";
import type { CodigoRequisito } from "@/lib/deals/requisitos";

/**
 * La cara CLIENTE del motor de etapas: datos planos, sin drizzle ni pg-core.
 *
 * El tablero corre en el navegador y necesita saber, para la etapa de una tarjeta, a
 * que etapas se puede arrastrar y quien mueve cada flecha. Esa informacion vive en
 * `lib/deals/etapas.ts`, pero ese modulo importa el esquema (drizzle), asi que NO puede
 * entrar al bundle del cliente (AGENTS.md: no importar drizzle/pg-core al cliente). El
 * servidor la aplana con `mapaDeTransiciones()` y la pasa como props; aqui viven el tipo
 * plano y las funciones puras que el cliente usa para decidir el arrastre.
 *
 * `import type` se borra en compilacion, asi que traer `EtapaDeal` de `etapas.ts` no
 * arrastra el modulo al bundle: es solo el tipo.
 */

/** Una flecha, en forma plana y serializable (lo que el servidor manda al cliente). */
export interface FlechaCliente {
  tipo: "etapa" | "pendiente";
  id: string;
  de: EtapaDeal;
  a: EtapaDeal;
  pendienteA: PendienteDeal | null;
  quien: QuienMueve;
  exigeMotivo: boolean;
  tipoDeMotivo: TipoMotivo | null;
  /** Los codigos de requisito que la flecha pide (para decidir si abrir un dialogo). */
  requisitos: CodigoRequisito[];
}

/** El mapa completo de transiciones, tal como el servidor lo pasa. */
export type MapaTransiciones = FlechaCliente[];

/**
 * Las flechas legales DESDE una etapa. El orden lo fija el servidor (orden del enum).
 */
export function flechasDesde(mapa: MapaTransiciones, de: EtapaDeal): FlechaCliente[] {
  // Sin las flechas que vuelven a la misma etapa (E7, una reagenda que sigue en
  // Agendado): no son un destino al que se mueva la tarjeta.
  return mapa.filter((f) => f.tipo === "etapa" && f.de === de && f.a !== de);
}

/**
 * ¿Se puede ARRASTRAR de `de` a `a`? Solo las flechas que puede tomar una PERSONA:
 * las de `quien: "sistema"` las pone el CRM cuando pasa el evento (un abono, el Grain),
 * asi que no se arrastran a mano. `ambos` y `closer` si.
 *
 * Es la reja del cliente para el resaltado y el "no-permitido" del arrastre; la reja de
 * verdad la vuelve a aplicar el servidor en `moverEtapa()` (nunca se confia del cliente).
 */
export function sePuedeArrastrar(mapa: MapaTransiciones, de: EtapaDeal, a: EtapaDeal): boolean {
  const f = mapa.find((x) => x.tipo === "etapa" && x.de === de && x.a === a);
  return f != null && f.quien !== "sistema";
}

/** Las etapas destino a las que una PERSONA puede arrastrar desde `de`. */
export function destinosArrastrables(mapa: MapaTransiciones, de: EtapaDeal): Set<EtapaDeal> {
  return new Set(mapa.filter((f) => f.tipo === "etapa" && f.de === de && f.quien !== "sistema").map((f) => f.a));
}

/**
 * La razon por la que una flecha del SISTEMA no se puede arrastrar, para mostrarla en el
 * menu "Mover a...". `null` si la flecha si es arrastrable o no existe.
 */
export function razonSistema(mapa: MapaTransiciones, de: EtapaDeal, a: EtapaDeal): string | null {
  const f = mapa.find((x) => x.tipo === "etapa" && x.de === de && x.a === a);
  if (!f || f.quien !== "sistema") return null;
  return "Lo pone el sistema cuando pasa el hecho (un abono, la agenda); no se mueve a mano.";
}

/**
 * ¿La flecha necesita que el usuario ESCRIBA algo antes de mover (abrir un dialogo)?
 * Es asi si exige motivo o pide alguno de los datos que se teclean (valor vendido, fechas,
 * cohorte destino). Los requisitos que se prueban con un HECHO (contacto, llamada,
 * abono) no se piden por dialogo: el motor los mide contra la base.
 */
const REQUISITOS_QUE_SE_TECLEAN: ReadonlySet<CodigoRequisito> = new Set([
  "valor_vendido",
  "area_declarada",
  "fecha_limite_pago",
  "cohorte_destino",
  "fecha_seguimiento",
  "motivo",
]);

export function flechaPideDatos(f: FlechaCliente): boolean {
  if (f.exigeMotivo) return true;
  return f.requisitos.some((r) => REQUISITOS_QUE_SE_TECLEAN.has(r));
}

/** Los campos que un dialogo tiene que pedir para esta flecha, en orden estable. */
export function camposDeDialogo(f: FlechaCliente): CodigoRequisito[] {
  const campos = f.requisitos.filter((r) => REQUISITOS_QUE_SE_TECLEAN.has(r));
  if (f.exigeMotivo && !campos.includes("motivo")) campos.push("motivo");
  return campos;
}
