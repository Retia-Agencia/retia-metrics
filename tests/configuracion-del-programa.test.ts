import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { crearPrograma, reactivarPrograma } from "@/lib/catalogo/programas";
import { programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  CLAVES_DE_PASO,
  mensajeDeActivacionBloqueada,
  pasosDeConfiguracion,
  pasosPendientes,
  seccionDeLaFicha,
  type ClaveDePaso,
  type HechosDeConfiguracion,
} from "@/lib/programas/configuracion";
import { hechosDeConfiguracion } from "@/lib/programas/hechos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

const SIN_CONFIGURAR: HechosDeConfiguracion = {
  pagoRapidoDefinido: false,
  tieneTokenCalendly: false,
  tieneFuentePrincipal: false,
  webhookCalendlyConectado: false,
  miembrosActivos: 0,
  tieneCohorteActiva: false,
  plataformasDePago: 0,
  cuentasMeta: 0,
};

describe("registro de configuración del programa", () => {
  it("redirige los ids viejos de la ficha y conserva los demás", () => {
    expect(seccionDeLaFicha("general")).toBe("programa");
    expect(seccionDeLaFicha("equipo")).toBe("programa");
    expect(seccionDeLaFicha("captacion")).toBe("integraciones");
    expect(seccionDeLaFicha("ventas")).toBe("ventas");
    expect(seccionDeLaFicha(undefined)).toBeUndefined();
    expect(seccionDeLaFicha("x")).toBe("x");
  });

  it("conserva el orden único de los pasos", () => {
    expect(pasosDeConfiguracion(SIN_CONFIGURAR).map((paso) => paso.clave)).toEqual(
      CLAVES_DE_PASO,
    );
  });

  it("datos comerciales exige el corte de pago rápido", () => {
    const estado = (hechos: Partial<HechosDeConfiguracion>) =>
      pasosDeConfiguracion({ ...SIN_CONFIGURAR, ...hechos }).find(
        (paso) => paso.clave === "datos",
      )!.hecho;

    expect(estado({ pagoRapidoDefinido: false })).toBe(false);
    expect(estado({ pagoRapidoDefinido: true })).toBe(true);
  });

  it.each([
    ["fuente_principal", { tieneFuentePrincipal: true }],
    ["equipo", { miembrosActivos: 1 }],
    ["cohorte_activa", { tieneCohorteActiva: true }],
    ["plataforma_pago", { plataformasDePago: 1 }],
    ["cuenta_meta", { cuentasMeta: 1 }],
  ] satisfies Array<[ClaveDePaso, Partial<HechosDeConfiguracion>]>) (
    "%s depende de su hecho único",
    (clave, hechos) => {
      expect(pasosDeConfiguracion(SIN_CONFIGURAR).find((paso) => paso.clave === clave)!.hecho).toBe(
        false,
      );
      expect(
        pasosDeConfiguracion({ ...SIN_CONFIGURAR, ...hechos }).find(
          (paso) => paso.clave === clave,
        )!.hecho,
      ).toBe(true);
    },
  );

  it("Calendly exige el token y los avisos en vivo", () => {
    const estado = (hechos: Partial<HechosDeConfiguracion>) =>
      pasosDeConfiguracion({ ...SIN_CONFIGURAR, ...hechos }).find(
        (paso) => paso.clave === "calendly",
      )!.hecho;

    expect(estado({ tieneTokenCalendly: true })).toBe(false);
    expect(estado({ webhookCalendlyConectado: true })).toBe(false);
    expect(estado({ tieneTokenCalendly: true, webhookCalendlyConectado: true })).toBe(true);
  });

  it("soloExigidos devuelve Calendly y el formulario principal en ese orden", () => {
    expect(
      pasosPendientes(SIN_CONFIGURAR, { soloExigidos: true }).map((paso) => paso.clave),
    ).toEqual(["calendly", "fuente_principal"]);
  });

  it("arma el mensaje con los títulos tal como están registrados", () => {
    const pendientes = pasosPendientes(SIN_CONFIGURAR, { soloExigidos: true });
    expect(mensajeDeActivacionBloqueada(pendientes)).toBe(
      "Todavía no se puede activar el programa. Falta: Calendly y Formulario principal.",
    );
  });
});

describe("paridad de la reja de activación", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let actorId: string;
  let programId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [actor] = await db
      .insert(users)
      .values({ email: "gerencia-configuracion@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
      .returning();
    actorId = actor.id;
    const programa = await crearPrograma(db, actorId, {
      nombre: "Programa de configuración",
      slug: "programa-configuracion",
    });
    programId = programa.id;
  });

  afterAll(async () => {
    await cerrar();
  });

  async function comprobarParidad() {
    const pendientes = pasosPendientes(await hechosDeConfiguracion(db, programId), {
      soloExigidos: true,
    });
    const error = await reactivarPrograma(db, actorId, programId).catch((causa) => causa);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    expect((error as ErrorDeApp).message).toBe(mensajeDeActivacionBloqueada(pendientes));
    for (const titulo of pendientes.map((paso) => paso.titulo)) {
      expect((error as ErrorDeApp).message).toContain(titulo);
    }
    const [programa] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(programa.activo).toBe(false);
  }

  it("token sin formulario principal produce la misma pendiente y conserva la fila inactiva", async () => {
    await sembrarIntegracion(db, programId, "calendly", { token: "token-de-prueba" });
    await comprobarParidad();
  });

  it("formulario principal sin token produce la misma pendiente y conserva la fila inactiva", async () => {
    await db.insert(sources).values({
      programId,
      nombre: "Formulario principal",
      tipo: "webhook",
      proveedor: "typeform",
      activo: true,
      principal: true,
      urlPublica: "https://form.typeform.com/to/principal",
    });
    await comprobarParidad();
  });
});

/**
 * 🩸 14-nov: vincular la cuenta de Meta desde el recorrido de un programa INACTIVO respondía
 * "No autorizado para este programa": la acción preguntaba `programaEnAlcance`, que solo ve
 * programas activos. Toda acción que un editor del recorrido llama tiene que autorizar con
 * `exigirAccesoAlPrograma` (ADR 0094 punto 4, ADR 0132). Este guardián lee los módulos de
 * acciones que esos editores importan.
 */
describe("las acciones del recorrido admiten un programa inactivo", () => {
  const ACCIONES_DEL_RECORRIDO = [
    "app/(app)/p/[programa]/programa/acciones-programa.ts",
    "app/(app)/p/[programa]/programa/acciones-integraciones.ts",
    "app/(app)/p/[programa]/programa/acciones-fuentes.ts",
    "app/(app)/p/[programa]/programa/acciones-meta.ts",
    "app/(app)/p/[programa]/programa/acciones.ts",
    "app/(app)/ajustes/usuarios/acciones.ts",
  ];

  it.each(ACCIONES_DEL_RECORRIDO)("%s no autoriza con programaEnAlcance", async (ruta) => {
    const { readFileSync } = await import("node:fs");
    const codigo = readFileSync(ruta, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codigo).not.toMatch(/programaEnAlcance\s*\(/);
  });
});
