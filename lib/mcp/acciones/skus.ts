import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { esAdministrador } from "@/lib/auth/roles";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { crearSku, desactivarSku, editarSku, reactivarSku, type EntradaSku } from "@/lib/catalogo/skus";
import { cohorts, programs, skus } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";
import type { ActorDeMovimiento } from "@/lib/deals/mover-deal";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

/**
 * Acciones de SKU del MCP (ticket 386). Llaman las MISMAS funciones que la pestaña Programa
 * (`lib/catalogo/skus.ts`): validación, cohorte nueva y rastro en change_log viven allá.
 * Aquí solo se decide quién puede, de qué programa es el objetivo y qué se muestra antes de confirmar.
 * Capacidad: la de la pantalla (`esAdministrador`: gerente y developer).
 */

const MENSAJE_PROGRAMA = "No puedes administrar este programa.";

type Actor = ActorDeMovimiento;

async function leerSku(db: Db, id: string, bloquear = false) {
  const consulta = db.select({ sku: skus, codigoCohorte: cohorts.codigo }).from(skus)
    .innerJoin(cohorts, eq(cohorts.id, skus.cohortId))
    .where(eq(skus.id, id));
  const [fila] = bloquear ? await consulta.for("update", { of: skus }) : await consulta;
  return fila ?? null;
}

function resumenDeSku(sku: typeof skus.$inferSelect) {
  return {
    codigo: sku.codigo,
    nombre: sku.nombre,
    precio_lista_usd: sku.precioListaUsd,
    comision_porcentaje: sku.comisionPorcentaje,
    cuenta_como_cupo: sku.cuentaComoCupo,
    predeterminado: sku.predeterminado,
    activo: sku.activo,
  };
}

function numeroDeCohorte(codigo: string): number {
  const coincidencia = /^C(\d+)$/.exec(codigo);
  if (!coincidencia) throw new ErrorDeApp(`La cohorte ${codigo} no tiene un número válido.`, 409);
  return Number(coincidencia[1]);
}

async function exigirPrograma(db: Db, actor: Actor, programId: string) {
  await exigirAccesoAlPrograma(db, { id: actor.userId, rol: actor.rol }, programId, MENSAJE_PROGRAMA);
}

async function huellaDeSku(db: Db, id: string, bloquear?: true): Promise<string | null> {
  const fila = await leerSku(db, id, bloquear === true);
  if (!fila) return null;
  return createHash("sha256").update(textoDeBitacora({ sku: fila.sku, cohorte: fila.codigoCohorte }) ?? "null").digest("hex");
}

async function ubicarSku(db: Db, objetivo: ObjetivoAccionMcp) {
  const fila = await leerSku(db, objetivo.id);
  return fila ? { programId: fila.sku.programId, nombre: fila.sku.codigo, antes: resumenDeSku(fila.sku) } : null;
}

const idDeSku = z.string().uuid("SKU inválido.");
const precio = z.string().trim().max(30);
const comision = z.number();

// ───────────────────────────────────────────── crear

const argumentosCrear = z.object({
  programa_id: z.string().uuid("Programa inválido."),
  nombre: z.string().trim().max(80),
  cohorte: z.number().int("La cohorte debe ser un entero."),
  precio_lista_usd: precio,
  comision_porcentaje: comision,
  cuenta_como_cupo: z.boolean().default(false),
  predeterminado: z.boolean().default(false),
  ventana: z.object({
    inicio_ventas: z.string().trim(),
    cierre_ventas: z.string().trim(),
    meta_cupos: z.number().int(),
    meta_leads_dia: z.number().int().optional(),
  }).strict().optional().describe("Solo si la cohorte es nueva: inicio y cierre de ventas (AAAA-MM-DD) y meta de cupos."),
}).strict();

interface ObjetivoCrear extends ObjetivoAccionMcp {
  datos: z.output<typeof argumentosCrear>;
}

function entradaDeCrear(datos: z.output<typeof argumentosCrear>): EntradaSku {
  return {
    programId: datos.programa_id,
    nombre: datos.nombre,
    cohorteN: datos.cohorte,
    precioListaUsd: datos.precio_lista_usd,
    comisionPorcentaje: datos.comision_porcentaje,
    cuentaComoCupo: datos.cuenta_como_cupo,
    predeterminado: datos.predeterminado,
    ...(datos.ventana ? {
      ventana: {
        fechaInicioVentas: datos.ventana.inicio_ventas,
        fechaCierreVentas: datos.ventana.cierre_ventas,
        metaCupos: datos.ventana.meta_cupos,
        ...(datos.ventana.meta_leads_dia === undefined ? {} : { metaLeadsDia: datos.ventana.meta_leads_dia }),
      },
    } : {}),
  };
}

async function ejecutarCrear(db: Db, actor: Actor, objetivo: ObjetivoCrear) {
  await exigirPrograma(db, actor, objetivo.id);
  const creado = await crearSku(db, actor.userId, entradaDeCrear(objetivo.datos));
  return { sku: creado, herencia: creado.herencia };
}

export const crearSkuMcp: AccionMcp<typeof argumentosCrear> = {
  clave: "crear_sku",
  titulo: "Crear SKU",
  cuandoUsarla: "Cuando un administrador crea un SKU de un programa. Si el número de cohorte es nuevo, la cohorte nace con él y exige la ventana de ventas y la meta de cupos.",
  argumentos: argumentosCrear,
  ejemplo: {
    programa_id: "00000000-0000-4000-8000-000000000000",
    nombre: "Programa completo",
    cohorte: 3,
    precio_lista_usd: "797.00",
    comision_porcentaje: 10,
    cuenta_como_cupo: true,
  },
  puede: (contexto) => esAdministrador(contexto.rol),
  objetivoAusente: "No existe ese programa.",
  objetivos: (entrada) => [{ id: entrada.programa_id, datos: entrada }],
  async ubicar(db, objetivo) {
    const [programa] = await db.select({ id: programs.id, nombre: programs.nombre }).from(programs).where(eq(programs.id, objetivo.id));
    return programa ? { programId: programa.id, nombre: programa.nombre, antes: null } : null;
  },
  async revisar(db, actor, base) {
    const objetivo = base as ObjetivoCrear;
    const prueba = await ensayar(db, (tx) => ejecutarCrear(tx, actor, objetivo));
    return {
      antes: null,
      despues: prueba.ok ? resumenDeSku(prueba.resultado.sku) : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        resumen: prueba.ok
          ? `crear el SKU ${prueba.resultado.sku.codigo} a ${prueba.resultado.sku.precioListaUsd} USD${prueba.resultado.herencia ? " (la cohorte nace con él)" : ""}`
          : `crear el SKU ${objetivo.datos.nombre} de la cohorte C${objetivo.datos.cohorte}`,
        ...(prueba.ok && prueba.resultado.herencia ? { cohorte_nueva: true, umbrales_heredados: prueba.resultado.herencia } : {}),
      },
    };
  },
  async huella(db, objetivo, opciones) {
    const consulta = db.select({ id: programs.id }).from(programs).where(eq(programs.id, objetivo.id));
    const [programa] = opciones?.bloquear ? await consulta.for("update") : await consulta;
    if (!programa) return null;
    const existentes = await db.select({ codigo: skus.codigo }).from(skus).where(eq(skus.programId, objetivo.id));
    const estable = textoDeBitacora(existentes.map((fila) => fila.codigo).sort());
    return createHash("sha256").update(estable ?? "null").digest("hex");
  },
  aplicar: (db, actor, objetivo) => ejecutarCrear(db, actor, objetivo as ObjetivoCrear),
  seDeshace: false,
  efectoExterno: false,
};

// ───────────────────────────────────────────── editar

const argumentosEditar = z.object({
  sku_id: idDeSku,
  nombre: z.string().trim().max(80).optional(),
  precio_lista_usd: precio.optional(),
  comision_porcentaje: comision.optional(),
  cuenta_como_cupo: z.boolean().optional(),
  predeterminado: z.boolean().optional(),
}).strict().refine(
  (datos) => Object.keys(datos).some((clave) => clave !== "sku_id"),
  { message: "Indica al menos un campo para cambiar." },
);

interface ObjetivoEditar extends ObjetivoAccionMcp {
  datos: z.output<typeof argumentosEditar>;
}

async function ejecutarEditar(db: Db, actor: Actor, objetivo: ObjetivoEditar) {
  const actual = await leerSku(db, objetivo.id);
  if (!actual) throw new ErrorDeApp("No existe un SKU con ese id.", 404);
  await exigirPrograma(db, actor, actual.sku.programId);
  const { datos } = objetivo;
  await editarSku(db, actor.userId, objetivo.id, {
    programId: actual.sku.programId,
    nombre: datos.nombre ?? actual.sku.nombre,
    cohorteN: numeroDeCohorte(actual.codigoCohorte),
    precioListaUsd: datos.precio_lista_usd ?? actual.sku.precioListaUsd,
    comisionPorcentaje: datos.comision_porcentaje ?? Number(actual.sku.comisionPorcentaje),
    cuentaComoCupo: datos.cuenta_como_cupo ?? actual.sku.cuentaComoCupo,
    predeterminado: datos.predeterminado ?? actual.sku.predeterminado,
  });
  return (await leerSku(db, objetivo.id))!.sku;
}

export const editarSkuMcp: AccionMcp<typeof argumentosEditar> = {
  clave: "editar_sku",
  titulo: "Editar SKU",
  cuandoUsarla: "Cuando un administrador cambia el nombre, el precio de lista, el % de comisión, si cuenta como cupo o si es predeterminado de un SKU. Solo se pasan los campos que cambian.",
  argumentos: argumentosEditar,
  ejemplo: { sku_id: "00000000-0000-4000-8000-000000000000", precio_lista_usd: "897.00" },
  puede: (contexto) => esAdministrador(contexto.rol),
  objetivoAusente: "No existe ese SKU en este programa.",
  objetivos: (entrada) => [{ id: entrada.sku_id, datos: entrada }],
  ubicar: ubicarSku,
  async revisar(db, actor, base) {
    const objetivo = base as ObjetivoEditar;
    const actual = await leerSku(db, objetivo.id);
    const prueba = await ensayar(db, (tx) => ejecutarEditar(tx, actor, objetivo));
    return {
      antes: actual ? resumenDeSku(actual.sku) : null,
      despues: prueba.ok ? resumenDeSku(prueba.resultado) : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: { resumen: `editar el SKU ${actual?.sku.codigo ?? objetivo.id}` },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeSku(db, objetivo.id, opciones?.bloquear),
  aplicar: (db, actor, objetivo) => ejecutarEditar(db, actor, objetivo as ObjetivoEditar),
  seDeshace: false,
  efectoExterno: false,
};

// ───────────────────────────────────────────── desactivar y reactivar

const argumentosActivo = z.object({ sku_id: idDeSku }).strict();

function accionDeActivo(
  clave: string,
  titulo: string,
  cuandoUsarla: string,
  activar: boolean,
): AccionMcp<typeof argumentosActivo> {
  const ejecutar = async (db: Db, actor: Actor, objetivo: ObjetivoAccionMcp) => {
    const actual = await leerSku(db, objetivo.id);
    if (!actual) throw new ErrorDeApp("No existe un SKU con ese id.", 404);
    await exigirPrograma(db, actor, actual.sku.programId);
    if (actual.sku.activo === activar) {
      throw new ErrorDeApp(activar ? "Ese SKU ya está activo." : "Ese SKU ya está inactivo.", 409);
    }
    return activar ? reactivarSku(db, actor.userId, objetivo.id) : desactivarSku(db, actor.userId, objetivo.id);
  };
  return {
    clave,
    titulo,
    cuandoUsarla,
    argumentos: argumentosActivo,
    ejemplo: { sku_id: "00000000-0000-4000-8000-000000000000" },
    puede: (contexto) => esAdministrador(contexto.rol),
    objetivoAusente: "No existe ese SKU en este programa.",
    objetivos: (entrada) => [{ id: entrada.sku_id }],
    ubicar: ubicarSku,
    async revisar(db, actor, objetivo) {
      const actual = await leerSku(db, objetivo.id);
      const prueba = await ensayar(db, (tx) => ejecutar(tx, actor, objetivo));
      return {
        antes: actual ? resumenDeSku(actual.sku) : null,
        despues: prueba.ok ? resumenDeSku(prueba.resultado) : null,
        sePuedeAplicar: prueba.ok,
        razon: prueba.ok ? null : prueba.razon,
        detalle: { resumen: `${activar ? "reactivar" : "desactivar"} el SKU ${actual?.sku.codigo ?? objetivo.id}` },
      };
    },
    huella: (db, objetivo, opciones) => huellaDeSku(db, objetivo.id, opciones?.bloquear),
    aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo),
    seDeshace: false,
    efectoExterno: false,
  };
}

export const desactivarSkuMcp = accionDeActivo(
  "desactivar_sku",
  "Desactivar SKU",
  "Cuando un administrador retira un SKU del catálogo: deja de ofrecerse en deals nuevos.",
  false,
);

export const reactivarSkuMcp = accionDeActivo(
  "reactivar_sku",
  "Reactivar SKU",
  "Cuando un administrador vuelve a ofrecer un SKU que estaba desactivado.",
  true,
);
