import { describe, expect, it } from "vitest";
import {
  closerHost,
  emparejarLlamada,
  type CloserDelPrograma,
  type LeadCandidato,
} from "@/lib/calendly/emparejar-llamada";

/**
 * El emparejador de llamadas de Calendly (ticket 096, ADR 0049). Cada regla se prueba en
 * los dos sentidos: lo que cuelga y lo que, por muy poco, ya no cuelga y queda suelto.
 */

const MARU = "u-maru";
const ANDREA = "u-andrea";
const CLOSERS: CloserDelPrograma[] = [
  { userId: MARU, correoCalendly: "maru.tactical@retiagrowth.com" },
  { userId: ANDREA, correoCalendly: "andrea.tactical@retiagrowth.com" },
];

function lead(o: {
  id: string;
  correos: (string | { valor: string; confirmado: boolean })[];
  deals?: { id: string; owner?: string | null }[];
}): LeadCandidato {
  return {
    leadId: o.id,
    correos: o.correos.map((c) => (typeof c === "string" ? { valor: c, confirmado: true } : c)),
    dealsAbiertos: (o.deals ?? []).map((d) => ({ dealId: d.id, ownerUserId: d.owner ?? null })),
  };
}

const ANA = lead({ id: "l-ana", correos: ["ana@correo.co"], deals: [{ id: "d-ana" }] });
const llamada = (correoInvitado: string | null, correoHost: string | null = null) => ({
  correoInvitado,
  correoHost,
});

describe("emparejarLlamada: a que deal va", () => {
  it("un solo lead con un solo deal abierto: se cuelga", () => {
    expect(emparejarLlamada(llamada("ana@correo.co"), [ANA], [])).toMatchObject({
      tipo: "colgada",
      leadId: "l-ana",
      dealId: "d-ana",
      llave: "correo",
    });
  });

  it("el deal resuelto por código gana aunque el correo sea distinto", () => {
    expect(
      emparejarLlamada(llamada("otra@correo.co"), [], CLOSERS, {
        leadId: "l-codigo",
        dealId: "d-codigo",
        ownerUserId: ANDREA,
      }),
    ).toMatchObject({ tipo: "colgada", llave: "codigo", leadId: "l-codigo", dealId: "d-codigo" });
  });

  it("el correo se compara normalizado, como la llave del lead", () => {
    expect(emparejarLlamada(llamada("  Ana@Correo.CO "), [ANA], [])).toMatchObject({
      tipo: "colgada",
      dealId: "d-ana",
    });
  });

  it("sin correo legible: suelta", () => {
    expect(emparejarLlamada(llamada(null), [ANA], [])).toEqual({ tipo: "suelta", motivo: "sin_correo" });
    expect(emparejarLlamada(llamada("no-es-correo"), [ANA], [])).toEqual({
      tipo: "suelta",
      motivo: "sin_correo",
    });
  });

  it("ningun lead con ese correo: suelta, nunca el mas parecido", () => {
    expect(emparejarLlamada(llamada("ana.perez@correo.co"), [ANA], [])).toEqual({
      tipo: "suelta",
      motivo: "sin_lead",
    });
  });

  it("dos leads del programa con el mismo correo: suelta", () => {
    const otra = lead({ id: "l-ana-2", correos: ["ana@correo.co"], deals: [{ id: "d-ana-2" }] });
    expect(emparejarLlamada(llamada("ana@correo.co"), [ANA, otra], [])).toEqual({
      tipo: "suelta",
      motivo: "varios_leads",
    });
  });

  it("el mismo lead repetido en los candidatos cuenta una vez", () => {
    expect(emparejarLlamada(llamada("ana@correo.co"), [ANA, ANA], [])).toMatchObject({
      tipo: "colgada",
      dealId: "d-ana",
    });
  });

  it("un correo SIN confirmar (unido por telefono) no empareja", () => {
    const unidoPorTelefono = lead({
      id: "l-beto",
      correos: ["beto@correo.co", { valor: "ana@correo.co", confirmado: false }],
      deals: [{ id: "d-beto" }],
    });
    expect(emparejarLlamada(llamada("ana@correo.co"), [unidoPorTelefono], [])).toEqual({
      tipo: "suelta",
      motivo: "sin_lead",
    });
    // Y no desempata: con el confirmado de Ana al lado, cuelga de Ana y no hay duda.
    expect(emparejarLlamada(llamada("ana@correo.co"), [unidoPorTelefono, ANA], [])).toMatchObject({
      tipo: "colgada",
      dealId: "d-ana",
    });
  });

  it("un correo secundario confirmado si empareja", () => {
    const conDos = lead({ id: "l-ana", correos: ["ana@correo.co", "ana.trabajo@empresa.co"], deals: [{ id: "d-ana" }] });
    expect(emparejarLlamada(llamada("ana.trabajo@empresa.co"), [conDos], [])).toMatchObject({
      tipo: "colgada",
      dealId: "d-ana",
    });
  });

  it("el lead sin deal abierto: suelta (Calendly no crea deals)", () => {
    const sinDeal = lead({ id: "l-ana", correos: ["ana@correo.co"] });
    expect(emparejarLlamada(llamada("ana@correo.co"), [sinDeal], [])).toEqual({
      tipo: "suelta",
      motivo: "sin_deal_abierto",
    });
  });

  it("el lead con dos deals abiertos: suelta", () => {
    const dos = lead({ id: "l-ana", correos: ["ana@correo.co"], deals: [{ id: "d-1" }, { id: "d-2" }] });
    expect(emparejarLlamada(llamada("ana@correo.co"), [dos], [])).toEqual({
      tipo: "suelta",
      motivo: "varios_deals_abiertos",
    });
  });

  it("el orden de los candidatos no cambia el resultado", () => {
    const beto = lead({ id: "l-beto", correos: ["beto@correo.co"], deals: [{ id: "d-beto" }] });
    const caro = lead({ id: "l-caro", correos: ["caro@correo.co"], deals: [{ id: "d-caro" }] });
    const conjuntos = [
      [ANA, beto, caro],
      [caro, ANA, beto],
      [beto, caro, ANA],
    ];
    const resultados = conjuntos.map((c) => emparejarLlamada(llamada("ana@correo.co", "maru.tactical@retiagrowth.com"), c, CLOSERS));
    for (const r of resultados) expect(r).toEqual(resultados[0]);
    const closersAlReves = [...CLOSERS].reverse();
    expect(emparejarLlamada(llamada("ana@correo.co", "maru.tactical@retiagrowth.com"), [ANA], closersAlReves)).toEqual(
      resultados[0],
    );
  });
});

describe("emparejarLlamada: el dueño (ADR 0049 punto 5, Mani 28-sep)", () => {
  it("deal sin dueño y host registrada: la host queda como dueña, sin aviso", () => {
    const r = emparejarLlamada(llamada("ana@correo.co", "maru.tactical@retiagrowth.com"), [ANA], CLOSERS);
    expect(r).toMatchObject({ tipo: "colgada", dueno: { antes: null, despues: MARU, cambio: false } });
  });

  it("deal sin dueño y host NO registrada: sigue sin dueño", () => {
    const r = emparejarLlamada(llamada("ana@correo.co", "otra@retiagrowth.com"), [ANA], CLOSERS);
    expect(r).toMatchObject({ tipo: "colgada", dueno: { antes: null, despues: null, cambio: false } });
  });

  it("deal de otra closer y la host registrada: pasa a la host y se avisa", () => {
    const deAndrea = lead({ id: "l-ana", correos: ["ana@correo.co"], deals: [{ id: "d-ana", owner: ANDREA }] });
    const r = emparejarLlamada(llamada("ana@correo.co", "maru.tactical@retiagrowth.com"), [deAndrea], CLOSERS);
    expect(r).toMatchObject({ tipo: "colgada", dueno: { antes: ANDREA, despues: MARU, cambio: true } });
  });

  it("deal de la misma host: no cambia nada", () => {
    const deMaru = lead({ id: "l-ana", correos: ["ana@correo.co"], deals: [{ id: "d-ana", owner: MARU }] });
    const r = emparejarLlamada(llamada("ana@correo.co", "Maru.Tactical@retiagrowth.com"), [deMaru], CLOSERS);
    expect(r).toMatchObject({ tipo: "colgada", dueno: { antes: MARU, despues: MARU, cambio: false } });
  });

  it("deal con dueño y host no registrada: el dueño se respeta", () => {
    const deAndrea = lead({ id: "l-ana", correos: ["ana@correo.co"], deals: [{ id: "d-ana", owner: ANDREA }] });
    const r = emparejarLlamada(llamada("ana@correo.co", null), [deAndrea], CLOSERS);
    expect(r).toMatchObject({ tipo: "colgada", dueno: { antes: ANDREA, despues: ANDREA, cambio: false } });
  });
});

describe("closerHost", () => {
  it("devuelve la closer cuyo Calendly es el host, normalizado", () => {
    expect(closerHost(" ANDREA.tactical@retiagrowth.com", CLOSERS)).toBe(ANDREA);
  });

  it("un correo de Calendly que reclaman dos closers es una duda: nadie", () => {
    const repetido = [...CLOSERS, { userId: "u-otra", correoCalendly: "maru.tactical@retiagrowth.com" }];
    expect(closerHost("maru.tactical@retiagrowth.com", repetido)).toBeNull();
  });

  it("la misma closer listada dos veces sigue siendo una", () => {
    expect(closerHost("maru.tactical@retiagrowth.com", [...CLOSERS, CLOSERS[0]])).toBe(MARU);
  });

  it("sin host o sin correo legible: nadie", () => {
    expect(closerHost(null, CLOSERS)).toBeNull();
    expect(closerHost("sin-arroba", CLOSERS)).toBeNull();
  });
});
