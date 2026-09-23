import { describe, expect, it } from "vitest";
import { resolverIdentidad, type ContactoConocido, type EnvioParaIdentidad } from "@/lib/ingesta/identidad";

/**
 * Ticket 050, la parte pura: ¿a que Lead pertenece cada Envio? (ADR 0035)
 *
 *  1. Mismo correo → el mismo Lead, sin preguntar.
 *  2. Telefono igual y correo distinto → se suma al Lead existente MARCADO.
 *  3. (Separar o confirmar lo hace un gerente: pantalla de la etapa 6.)
 *  4. Otro programa → otro Lead. Esta funcion recibe UN programa: el cruce no se puede
 *     ni pedir, porque los contactos conocidos que recibe son de ese programa.
 *
 * 🩸 La marca y no la fusion: 37 telefonos de Tactical tienen mas de un correo, y
 * parte son personas distintas con numero compartido. Fusionar no se deshace.
 */

function envio(
  token: string,
  posicion: number,
  correo: string | null,
  telefono: string | null,
): EnvioParaIdentidad {
  return { token, posicion, correo, telefono };
}

describe("resolverIdentidad", () => {
  it("el mismo correo es el mismo Lead, y los dos envios quedan", () => {
    const r = resolverIdentidad([
      envio("t1", 2, "ana@correo.co", "573001111111"),
      envio("t2", 3, "ana@correo.co", "573001111111"),
    ], []);
    expect(r.asignaciones.map((a) => a.lead)).toEqual([
      { tipo: "nuevo", correo: "ana@correo.co" },
      { tipo: "nuevo", correo: "ana@correo.co" },
    ]);
    expect(r.asignaciones.map((a) => a.motivo)).toEqual(["nuevo", "correo"]);
    expect(r.asignaciones.every((a) => !a.marcado)).toBe(true);
  });

  it("un correo que ya existe en la base cae en ese Lead", () => {
    const conocidos: ContactoConocido[] = [{ leadId: "L-ana", tipo: "correo", valor: "ana@correo.co" }];
    const r = resolverIdentidad([envio("t1", 2, "ana@correo.co", null)], conocidos);
    expect(r.asignaciones[0].lead).toEqual({ tipo: "existente", leadId: "L-ana" });
    expect(r.contactosNuevos).toEqual([]);
  });

  it("telefono igual y correo distinto: se une al Lead del telefono, MARCADO", () => {
    const r = resolverIdentidad([
      envio("t1", 2, "ana@correo.co", "573001111111"),
      envio("t2", 3, "ana.trabajo@empresa.co", "573001111111"),
    ], []);
    expect(r.asignaciones[1]).toMatchObject({
      lead: { tipo: "nuevo", correo: "ana@correo.co" },
      motivo: "telefono",
      marcado: true,
    });
    // El correo nuevo se suma al Lead SIN confirmar, con el envio del que llego.
    expect(r.contactosNuevos).toContainEqual({
      lead: { tipo: "nuevo", correo: "ana@correo.co" },
      tipo: "correo",
      valor: "ana.trabajo@empresa.co",
      token: "t2",
      esPrincipal: false,
      confirmado: false,
    });
    expect(r.posiblesDuplicados).toHaveLength(1);
  });

  it("el correo manda sobre el telefono: si cada uno apunta a un Lead distinto, gana el correo", () => {
    const conocidos: ContactoConocido[] = [
      { leadId: "L-ana", tipo: "correo", valor: "ana@correo.co" },
      { leadId: "L-beto", tipo: "telefono", valor: "573002222222" },
    ];
    const r = resolverIdentidad([envio("t1", 2, "ana@correo.co", "573002222222")], conocidos);
    expect(r.asignaciones[0]).toMatchObject({
      lead: { tipo: "existente", leadId: "L-ana" },
      motivo: "correo",
      marcado: false,
    });
    // El telefono ya es de otro Lead: NO se le quita ni se duplica (unico por programa).
    expect(r.contactosNuevos).toEqual([]);
    // Pero queda para que un gerente lo mire.
    expect(r.posiblesDuplicados).toEqual([
      { token: "t1", motivo: "telefono_de_otro_lead", leads: ["L-ana", "L-beto"] },
    ]);
  });

  it("una familia con el mismo numero: tres correos, un Lead marcado, ninguna fusion ciega", () => {
    // La muestra que importa del 050: cada correo distinto con el mismo telefono queda
    // MARCADO, nunca unido en silencio. Un gerente decide si son la misma persona.
    const r = resolverIdentidad([
      envio("t1", 2, "mama@correo.co", "573003333333"),
      envio("t2", 3, "hijo@correo.co", "573003333333"),
      envio("t3", 4, "hija@correo.co", "573003333333"),
    ], []);
    expect(r.asignaciones.map((a) => a.marcado)).toEqual([false, true, true]);
    expect(r.contactosNuevos.filter((c) => c.tipo === "correo" && !c.confirmado)).toHaveLength(2);
    expect(r.posiblesDuplicados).toHaveLength(2);
  });

  it("un parcial sin correo ni telefono no se cuelga de nadie", () => {
    const r = resolverIdentidad([envio("t1", 2, null, null)], []);
    expect(r.asignaciones[0]).toEqual({
      token: "t1",
      posicion: 2,
      lead: null,
      motivo: "sin_contacto",
      marcado: false,
    });
  });

  it("un parcial sin correo con un telefono conocido se une MARCADO", () => {
    const conocidos: ContactoConocido[] = [{ leadId: "L-ana", tipo: "telefono", valor: "573001111111" }];
    const r = resolverIdentidad([envio("t1", 2, null, "573001111111")], conocidos);
    expect(r.asignaciones[0]).toMatchObject({
      lead: { tipo: "existente", leadId: "L-ana" },
      motivo: "telefono",
      marcado: true,
    });
  });

  it("un parcial sin correo y con un telefono desconocido no crea Lead: la llave es el correo", () => {
    const r = resolverIdentidad([envio("t1", 2, null, "573009999999")], []);
    expect(r.asignaciones[0]).toMatchObject({ lead: null, motivo: "sin_correo" });
  });

  it("el primer correo de un Lead nuevo es su principal y queda confirmado", () => {
    const r = resolverIdentidad([envio("t1", 2, "ana@correo.co", "573001111111")], []);
    expect(r.contactosNuevos).toEqual([
      {
        lead: { tipo: "nuevo", correo: "ana@correo.co" },
        tipo: "correo",
        valor: "ana@correo.co",
        token: "t1",
        esPrincipal: true,
        confirmado: true,
      },
      {
        lead: { tipo: "nuevo", correo: "ana@correo.co" },
        tipo: "telefono",
        valor: "573001111111",
        token: "t1",
        esPrincipal: true,
        confirmado: true,
      },
    ]);
  });

  it("es determinista: el orden de llegada no cambia el resultado, manda la posicion", () => {
    const envios = [
      envio("t1", 2, "ana@correo.co", "573001111111"),
      envio("t2", 3, "otra@correo.co", "573001111111"),
      envio("t3", 4, "ana@correo.co", null),
    ];
    const enOrden = resolverIdentidad(envios, []);
    const alReves = resolverIdentidad([...envios].reverse(), []);
    expect(alReves).toEqual(enOrden);
  });
});
