import type { EtapaDeal, PendienteDeal, QuienMueve, TipoMotivo } from "@/lib/deals/etapas";
import type { CodigoRequisito } from "@/lib/deals/requisitos";

/**
 * La cara CLIENTE del motor de etapas: datos planos, sin drizzle ni pg-core.
 *
 * El dialogo de una respuesta corre en el navegador y necesita saber que datos pide su
 * flecha y quien la mueve. Esa informacion vive en
 * `lib/deals/etapas.ts`, pero ese modulo importa el esquema (drizzle), asi que NO puede
 * entrar al bundle del cliente (AGENTS.md: no importar drizzle/pg-core al cliente). El
 * servidor la aplana con `mapaDeTransiciones()` y la pasa como props; aqui viven el tipo
 * plano y lo que el dialogo necesita de el. Que respuesta lleva a que columna lo dice la
 * pregunta de la etapa (`pregunta-de-etapa.ts`).
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

/** Destino dinámico de corregir, calculado por el servidor desde el último historial. */
export interface CorreccionCliente {
  a: EtapaDeal;
  pendiente: PendienteDeal | null;
  flecha: FlechaCliente;
}

/**
 * Los datos que se TECLEAN en el dialogo de una flecha: motivo, valor vendido, fechas,
 * cohorte destino. Los requisitos que se prueban con un HECHO (contacto, llamada, abono)
 * no se piden por dialogo: el motor los mide contra la base.
 */
const REQUISITOS_QUE_SE_TECLEAN: ReadonlySet<CodigoRequisito> = new Set([
  "valor_vendido",
  "fecha_limite_pago",
  "cohorte_destino",
  "fecha_seguimiento",
  "motivo",
]);

/** Los campos que un dialogo tiene que pedir para esta flecha, en orden estable. */
export function camposDeDialogo(f: FlechaCliente): CodigoRequisito[] {
  const campos = f.requisitos.filter((r) => REQUISITOS_QUE_SE_TECLEAN.has(r));
  if (f.exigeMotivo && !campos.includes("motivo")) campos.push("motivo");
  return campos;
}
