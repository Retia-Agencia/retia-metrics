import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { TRANSICIONES } from "@/lib/deals/etapas";
import {
  REQUISITOS,
  requisitoFaltante,
  TransicionInexistenteError,
  type HechosDelDeal,
} from "@/lib/deals/requisitos";

/**
 * Ticket 044 — los requisitos de entrada de cada transicion, como predicados puros
 * (structure.md §3.1 columna "Requisito"). Cada requisito se muerde en los DOS sentidos:
 * unos hechos que lo cumplen dan `null`, y unos que no lo cumplen dan el `Faltante` con
 * su `codigo` estable. Probar solo un sentido dejaria pasar un predicado que devuelve
 * siempre lo mismo.
 *
 * Los hechos se arman en memoria: estos predicados no tocan base, sesion ni reloj, asi
 * que el test no necesita ninguna de las tres.
 */

/** Un deal sin nada: el estado base del que partimos y al que le vamos agregando hechos. */
function hechosVacios(): HechosDelDeal {
  return {
    ownerUserId: null,
    productoId: null,
    fechaLimitePago: null,
    cohorteDestinoId: null,
    fechaSeguimiento: null,
    motivoId: null,
    actividades: [],
    llamadas: [],
    abono: null,
    saldoTrasAbono: null,
    anulacion: null,
    enEtapaDesde: null,
  };
}

describe("requisitoFaltante contra la lista blanca (ticket 043)", () => {
  it("una flecha que no existe en TRANSICIONES lanza, no inventa un requisito", () => {
    // pendiente_setteo -> atendido no existe en la tabla.
    expect(() => requisitoFaltante("pendiente_setteo", "atendido", hechosVacios())).toThrow(
      TransicionInexistenteError,
    );
  });
});

describe("T1 (1→2): owner + contacto con fecha y canal", () => {
  it("sin owner falta el owner", () => {
    const f = requisitoFaltante("pendiente_setteo", "en_contacto", hechosVacios());
    expect(f?.codigo).toBe("SIN_OWNER");
  });

  it("con owner pero sin contacto falta el contacto", () => {
    const h = { ...hechosVacios(), ownerUserId: "u1" };
    expect(requisitoFaltante("pendiente_setteo", "en_contacto", h)?.codigo).toBe("SIN_CONTACTO");
  });

  it("un contacto sin canal no cuenta", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      ownerUserId: "u1",
      actividades: [{ tipo: "contacto", fecha: new Date("2026-09-27"), canal: null }],
    };
    expect(requisitoFaltante("pendiente_setteo", "en_contacto", h)?.codigo).toBe("SIN_CONTACTO");
  });

  it("una nota con fecha y canal no es un contacto", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      ownerUserId: "u1",
      actividades: [{ tipo: "nota", fecha: new Date("2026-09-27"), canal: "whatsapp" }],
    };
    expect(requisitoFaltante("pendiente_setteo", "en_contacto", h)?.codigo).toBe("SIN_CONTACTO");
  });

  it("owner + contacto con fecha y canal cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      ownerUserId: "u1",
      actividades: [{ tipo: "contacto", fecha: new Date("2026-09-27"), canal: "whatsapp" }],
    };
    expect(requisitoFaltante("pendiente_setteo", "en_contacto", h)).toBeNull();
  });
});

describe("llamada con fecha (T2, T3, T6, T23, T27)", () => {
  const flechas: [Parameters<typeof requisitoFaltante>[0], Parameters<typeof requisitoFaltante>[1]][] = [
    ["pendiente_setteo", "agendado"], // T2
    ["en_contacto", "agendado"], // T3
    ["pendiente_reagenda", "agendado"], // T6
    ["proxima_cohorte", "agendado"], // T23
    ["seguimiento", "agendado"], // T27
  ];

  for (const [de, a] of flechas) {
    it(`${de} → ${a}: sin llamada con fecha falta la agenda`, () => {
      expect(requisitoFaltante(de, a, hechosVacios())?.codigo).toBe("SIN_LLAMADA_AGENDADA");
    });

    it(`${de} → ${a}: con una llamada con fecha cumple`, () => {
      const h: HechosDelDeal = {
        ...hechosVacios(),
        llamadas: [{ fechaAgenda: new Date("2026-10-01"), resultado: "agendada", grainUrl: null, sucedio: false }],
      };
      expect(requisitoFaltante(de, a, h)).toBeNull();
    });
  }

  it("una llamada sin fecha de agenda no cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: null, resultado: "agendada", grainUrl: null, sucedio: false }],
    };
    expect(requisitoFaltante("en_contacto", "agendado", h)?.codigo).toBe("SIN_LLAMADA_AGENDADA");
  });
});

describe("compromiso: producto + fecha limite (T4, T12, T25)", () => {
  const flechas: [Parameters<typeof requisitoFaltante>[0], Parameters<typeof requisitoFaltante>[1]][] = [
    ["en_contacto", "compromiso_verbal"], // T4
    ["atendido", "compromiso_verbal"], // T12
    ["seguimiento", "compromiso_verbal"], // T25
  ];

  for (const [de, a] of flechas) {
    it(`${de} → ${a}: sin producto falta el producto`, () => {
      expect(requisitoFaltante(de, a, hechosVacios())?.codigo).toBe("SIN_PRODUCTO");
    });

    it(`${de} → ${a}: con producto pero sin fecha falta la fecha limite`, () => {
      const h = { ...hechosVacios(), productoId: "p1" };
      expect(requisitoFaltante(de, a, h)?.codigo).toBe("SIN_FECHA_LIMITE");
    });

    it(`${de} → ${a}: producto + fecha limite cumple`, () => {
      const h = { ...hechosVacios(), productoId: "p1", fechaLimitePago: new Date("2026-10-15") };
      expect(requisitoFaltante(de, a, h)).toBeNull();
    });
  }
});

describe("abono con producto (T5, T13, T14)", () => {
  it("T5 (2→7): sin producto falta el producto", () => {
    expect(requisitoFaltante("en_contacto", "abonado", hechosVacios())?.codigo).toBe("SIN_PRODUCTO");
  });

  it("T5 (2→7): con producto pero sin abono falta el abono", () => {
    const h = { ...hechosVacios(), productoId: "p1" };
    expect(requisitoFaltante("en_contacto", "abonado", h)?.codigo).toBe("SIN_ABONO");
  });

  it("T5 (2→7): abono sin comprobante falta el comprobante", () => {
    const h: HechosDelDeal = { ...hechosVacios(), productoId: "p1", abono: { monto: 100, comprobanteUrl: null } };
    expect(requisitoFaltante("en_contacto", "abonado", h)?.codigo).toBe("SIN_COMPROBANTE");
  });

  it("T5 (2→7): saldo desconocido no cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: null,
    };
    expect(requisitoFaltante("en_contacto", "abonado", h)?.codigo).toBe("SALDO_DESCONOCIDO");
  });

  it("T5 (2→7 abonado): saldo cero manda a Completo, no a Abonado", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 0,
    };
    expect(requisitoFaltante("en_contacto", "abonado", h)?.codigo).toBe("SIN_SALDO_PENDIENTE");
  });

  it("T5 (2→7 abonado): producto + abono + comprobante + saldo>0 cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 50,
    };
    expect(requisitoFaltante("en_contacto", "abonado", h)).toBeNull();
  });

  it("T5 (2→8 completo): saldo pendiente manda a Abonado, no a Completo", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 50,
    };
    expect(requisitoFaltante("en_contacto", "completo", h)?.codigo).toBe("SALDO_PENDIENTE");
  });

  it("T5 (2→8 completo): saldo cero cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 0,
    };
    expect(requisitoFaltante("en_contacto", "completo", h)).toBeNull();
  });

  it("T13 (5→7 abonado): saldo>0 cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 50,
    };
    expect(requisitoFaltante("atendido", "abonado", h)).toBeNull();
  });

  it("T14 (5→8 completo): saldo cero cumple; saldo>0 no", () => {
    const base: HechosDelDeal = {
      ...hechosVacios(),
      productoId: "p1",
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 0,
    };
    expect(requisitoFaltante("atendido", "completo", base)).toBeNull();
    expect(requisitoFaltante("atendido", "completo", { ...base, saldoTrasAbono: 10 })?.codigo).toBe("SALDO_PENDIENTE");
  });
});

describe("abono sin exigir producto (T16, T17, T26)", () => {
  it("T16 (6→7): no exige producto (ya viene de T4/T12); sin abono falta el abono", () => {
    expect(requisitoFaltante("compromiso_verbal", "abonado", hechosVacios())?.codigo).toBe("SIN_ABONO");
  });

  it("T16 (6→7 abonado): abono + comprobante + saldo>0 cumple sin producto", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 50,
    };
    expect(requisitoFaltante("compromiso_verbal", "abonado", h)).toBeNull();
  });

  it("T17 (6→8 completo): saldo cero cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 0,
    };
    expect(requisitoFaltante("compromiso_verbal", "completo", h)).toBeNull();
  });

  it("T26 (11→7 abonado): saldo>0 cumple; T26 (11→8 completo): saldo cero cumple", () => {
    const abonado: HechosDelDeal = {
      ...hechosVacios(),
      abono: { monto: 100, comprobanteUrl: "http://c" },
      saldoTrasAbono: 30,
    };
    expect(requisitoFaltante("seguimiento", "abonado", abonado)).toBeNull();
    expect(requisitoFaltante("seguimiento", "completo", { ...abonado, saldoTrasAbono: 0 })).toBeNull();
  });
});

describe("T18 (7→8): saldo en cero", () => {
  it("saldo desconocido no cumple", () => {
    expect(requisitoFaltante("abonado", "completo", hechosVacios())?.codigo).toBe("SALDO_DESCONOCIDO");
  });

  it("saldo pendiente no cumple", () => {
    const h = { ...hechosVacios(), saldoTrasAbono: 20 };
    expect(requisitoFaltante("abonado", "completo", h)?.codigo).toBe("SALDO_PENDIENTE");
  });

  it("saldo cero cumple", () => {
    const h = { ...hechosVacios(), saldoTrasAbono: 0 };
    expect(requisitoFaltante("abonado", "completo", h)).toBeNull();
  });
});

describe("Grain o sucedio (T7, T10)", () => {
  it("T7 (3→5): sin Grain ni sucedio no cumple", () => {
    expect(requisitoFaltante("pendiente_reagenda", "atendido", hechosVacios())?.codigo).toBe("SIN_GRAIN");
  });

  it("T7 (3→5): con Grain cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: null, resultado: "show", grainUrl: "http://grain", sucedio: false }],
    };
    expect(requisitoFaltante("pendiente_reagenda", "atendido", h)).toBeNull();
  });

  it('T10 (4→5): con "sucedio" (sin Grain) cumple', () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: null, resultado: "show", grainUrl: null, sucedio: true }],
    };
    expect(requisitoFaltante("agendado", "atendido", h)).toBeNull();
  });
});

describe("T8 (4→3): la ultima llamada quedo no_show o cancelada", () => {
  it("sin llamadas no cumple", () => {
    expect(requisitoFaltante("agendado", "pendiente_reagenda", hechosVacios())?.codigo).toBe("LLAMADA_NO_FALLIDA");
  });

  it("ultima llamada show no cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: new Date(), resultado: "show", grainUrl: null, sucedio: true }],
    };
    expect(requisitoFaltante("agendado", "pendiente_reagenda", h)?.codigo).toBe("LLAMADA_NO_FALLIDA");
  });

  it("ultima llamada no_show cumple (aunque una anterior fuera show)", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [
        { fechaAgenda: new Date("2026-09-01"), resultado: "show", grainUrl: null, sucedio: true },
        { fechaAgenda: new Date("2026-09-10"), resultado: "no_show", grainUrl: null, sucedio: false },
      ],
    };
    expect(requisitoFaltante("agendado", "pendiente_reagenda", h)).toBeNull();
  });

  it("la ultima es la de fecha mas reciente, no la ultima del arreglo", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [
        { fechaAgenda: new Date("2026-09-10"), resultado: "no_show", grainUrl: null, sucedio: false },
        { fechaAgenda: new Date("2026-09-01"), resultado: "show", grainUrl: null, sucedio: true },
      ],
    };
    expect(requisitoFaltante("agendado", "pendiente_reagenda", h)).toBeNull();
    const alReves: HechosDelDeal = { ...h, llamadas: [...h.llamadas].reverse() };
    expect(requisitoFaltante("agendado", "pendiente_reagenda", alReves)).toBeNull();
  });

  it("ultima llamada cancelada cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: new Date(), resultado: "cancelada", grainUrl: null, sucedio: false }],
    };
    expect(requisitoFaltante("agendado", "pendiente_reagenda", h)).toBeNull();
  });
});

describe("T9 (4→4): llamada reagendada + otra con fecha", () => {
  it("sin reagendada no cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: new Date(), resultado: "agendada", grainUrl: null, sucedio: false }],
    };
    expect(requisitoFaltante("agendado", "agendado", h)?.codigo).toBe("SIN_REAGENDADA");
  });

  it("reagendada pero sin una nueva con fecha no cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [{ fechaAgenda: null, resultado: "reagendada", grainUrl: null, sucedio: false }],
    };
    expect(requisitoFaltante("agendado", "agendado", h)?.codigo).toBe("SIN_NUEVA_FECHA");
  });

  it("reagendada + otra con fecha cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      llamadas: [
        { fechaAgenda: null, resultado: "reagendada", grainUrl: null, sucedio: false },
        { fechaAgenda: new Date("2026-10-05"), resultado: "agendada", grainUrl: null, sucedio: false },
      ],
    };
    expect(requisitoFaltante("agendado", "agendado", h)).toBeNull();
  });
});

describe("motivo (T15, T29, P, R)", () => {
  const flechas: [Parameters<typeof requisitoFaltante>[0], Parameters<typeof requisitoFaltante>[1]][] = [
    ["compromiso_verbal", "seguimiento"], // T15
    ["atendido", "pendiente_reagenda"], // T29
    ["en_contacto", "cierre_perdido"], // P
    ["cierre_perdido", "en_contacto"], // R
    ["cierre_perdido", "agendado"], // R
    ["cierre_perdido", "proxima_cohorte"], // R
  ];

  for (const [de, a] of flechas) {
    it(`${de} → ${a}: sin motivo falta el motivo`, () => {
      expect(requisitoFaltante(de, a, hechosVacios())?.codigo).toBe("SIN_MOTIVO");
    });

    it(`${de} → ${a}: con motivo cumple`, () => {
      expect(requisitoFaltante(de, a, { ...hechosVacios(), motivoId: "m1" })).toBeNull();
    });
  }
});

describe("cohorte destino (T19, T20, T21, T28)", () => {
  const flechas: [Parameters<typeof requisitoFaltante>[0], Parameters<typeof requisitoFaltante>[1]][] = [
    ["en_contacto", "proxima_cohorte"], // T19
    ["atendido", "proxima_cohorte"], // T20
    ["compromiso_verbal", "proxima_cohorte"], // T21
    ["seguimiento", "proxima_cohorte"], // T28
  ];

  for (const [de, a] of flechas) {
    it(`${de} → ${a}: sin cohorte destino no cumple`, () => {
      expect(requisitoFaltante(de, a, hechosVacios())?.codigo).toBe("SIN_COHORTE_DESTINO");
    });

    it(`${de} → ${a}: con cohorte destino cumple`, () => {
      expect(requisitoFaltante(de, a, { ...hechosVacios(), cohorteDestinoId: "c1" })).toBeNull();
    });
  }
});

describe("T24 (5→11): fecha de seguimiento", () => {
  it("sin fecha de seguimiento no cumple", () => {
    expect(requisitoFaltante("atendido", "seguimiento", hechosVacios())?.codigo).toBe("SIN_FECHA_SEGUIMIENTO");
  });

  it("con fecha de seguimiento cumple", () => {
    const h = { ...hechosVacios(), fechaSeguimiento: new Date("2026-10-20") };
    expect(requisitoFaltante("atendido", "seguimiento", h)).toBeNull();
  });
});

describe("T22 (9→2): contacto nuevo tras reentrar", () => {
  it("sin marca de entrada (enEtapaDesde) no se puede decidir", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      actividades: [{ tipo: "contacto", fecha: new Date("2026-09-27"), canal: "whatsapp" }],
    };
    expect(requisitoFaltante("proxima_cohorte", "en_contacto", h)?.codigo).toBe("SIN_MARCA_DE_ENTRADA");
  });

  it("un contacto anterior a enEtapaDesde no es nuevo", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      enEtapaDesde: new Date("2026-09-15"),
      actividades: [{ tipo: "contacto", fecha: new Date("2026-09-10"), canal: "whatsapp" }],
    };
    expect(requisitoFaltante("proxima_cohorte", "en_contacto", h)?.codigo).toBe("SIN_CONTACTO_NUEVO");
  });

  it("un contacto posterior a enEtapaDesde cumple", () => {
    const h: HechosDelDeal = {
      ...hechosVacios(),
      enEtapaDesde: new Date("2026-09-15"),
      actividades: [{ tipo: "contacto", fecha: new Date("2026-09-20"), canal: "whatsapp" }],
    };
    expect(requisitoFaltante("proxima_cohorte", "en_contacto", h)).toBeNull();
  });
});

describe("anulacion con motivo (A1, A2)", () => {
  const flechas: [Parameters<typeof requisitoFaltante>[0], Parameters<typeof requisitoFaltante>[1]][] = [
    ["abonado", "en_contacto"], // A1
    ["abonado", "atendido"], // A1
    ["abonado", "compromiso_verbal"], // A1
    ["abonado", "seguimiento"], // A1
    ["completo", "abonado"], // A2
  ];

  for (const [de, a] of flechas) {
    it(`${de} → ${a}: sin anulacion falta el motivo`, () => {
      expect(requisitoFaltante(de, a, hechosVacios())?.codigo).toBe("SIN_MOTIVO_ANULACION");
    });

    it(`${de} → ${a}: anulacion con motivo en blanco no cumple`, () => {
      const h = { ...hechosVacios(), anulacion: { motivo: "   " } };
      expect(requisitoFaltante(de, a, h)?.codigo).toBe("SIN_MOTIVO_ANULACION");
    });

    it(`${de} → ${a}: anulacion con motivo cumple`, () => {
      const h = { ...hechosVacios(), anulacion: { motivo: "error de tecleo" } };
      expect(requisitoFaltante(de, a, h)).toBeNull();
    });
  }
});

describe("guardian: cada flecha de TRANSICIONES tiene requisito, y ninguno sobra", () => {
  /** La llave de REQUISITOS es `id:destino` (misma forma que en el modulo). */
  const clavesEsperadas = new Set(TRANSICIONES.map((t) => `${t.id}:${t.a}`));
  const clavesReales = new Set(Object.keys(REQUISITOS));

  it("cada transicion de la lista blanca tiene una entrada de requisito", () => {
    const faltan = [...clavesEsperadas].filter((c) => !clavesReales.has(c));
    expect(faltan, `flechas sin requisito: ${faltan.join(", ")}`).toEqual([]);
  });

  it("no hay un requisito para una flecha que no existe en TRANSICIONES", () => {
    const sobran = [...clavesReales].filter((c) => !clavesEsperadas.has(c));
    expect(sobran, `requisitos sin flecha: ${sobran.join(", ")}`).toEqual([]);
  });

  it("toda flecha de la lista blanca se puede consultar sin lanzar", () => {
    for (const t of TRANSICIONES) {
      expect(() => requisitoFaltante(t.de, t.a, hechosVacios()), `${t.id} ${t.de}→${t.a}`).not.toThrow();
    }
  });
});

describe("guardian estatico: requisitos.ts no importa base, consultas ni auth", () => {
  const archivo = fileURLToPath(new URL("../lib/deals/requisitos.ts", import.meta.url));
  const fuente = fs.readFileSync(archivo, "utf8");

  /** Solo las lineas de import, para no cazar una mencion en un comentario. */
  const lineasDeImport = fuente
    .split("\n")
    .filter((l) => /^\s*import\b/.test(l) || /from\s+["']/.test(l));

  it("no importa nada de lib/queries ni de auth", () => {
    for (const linea of lineasDeImport) {
      expect(linea, `import prohibido: ${linea.trim()}`).not.toMatch(/lib\/queries/);
      expect(linea, `import prohibido: ${linea.trim()}`).not.toMatch(/lib\/auth/);
    }
  });

  it("de lib/db solo importa tipos (import type), nunca valores de la conexion", () => {
    for (const linea of lineasDeImport) {
      if (!/lib\/db/.test(linea)) continue;
      // Se permite `import type ... from "@/lib/db/schema"` (solo tipos), y el enum de
      // resultado de llamada, del que se DERIVA un tipo con typeof (no toca la base).
      const esTipo = /^\s*import\s+type\b/.test(linea);
      const esEnumParaTipo = /resultadoLlamadaEnum/.test(linea) && /schema/.test(linea);
      expect(esTipo || esEnumParaTipo, `import de lib/db no permitido: ${linea.trim()}`).toBe(true);
      // Nunca la conexion ni el cliente.
      expect(linea).not.toMatch(/lib\/db\/(index|cliente|client)\b/);
    }
  });
});
