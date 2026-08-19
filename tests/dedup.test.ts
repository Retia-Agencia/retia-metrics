import { describe, expect, it } from "vitest";
import { deduplicarPorCorreo, filasDesdeMatriz } from "@/lib/sheets/dedup";
import {
  resolverColumnas,
  MapeoInvalidoError,
  MAPEO_FORMULARIO,
  OBLIGATORIOS_FORMULARIO,
  parsearFecha,
  normalizarEmail,
} from "@/lib/sheets/mapeo";

describe("normalizarEmail", () => {
  it("baja a minusculas y recorta", () => {
    expect(normalizarEmail("  Michael@Retia.CO ")).toBe("michael@retia.co");
  });
  it("rechaza lo que no es correo", () => {
    expect(normalizarEmail("sin arroba")).toBeNull();
    expect(normalizarEmail("")).toBeNull();
    expect(normalizarEmail(null)).toBeNull();
  });
});

describe("parsearFecha", () => {
  it("lee el formato colombiano d/m/yyyy, no m/d", () => {
    // 7 de agosto, no 8 de julio
    const f = parsearFecha("7/8/2026 14:30:00")!;
    expect(f.getDate()).toBe(7);
    expect(f.getMonth()).toBe(7); // agosto
  });
  it("distingue dias que serian ambiguos", () => {
    const f = parsearFecha("3/12/2026")!;
    expect(f.getDate()).toBe(3);
    expect(f.getMonth()).toBe(11); // diciembre
  });
  it("acepta ISO", () => {
    expect(parsearFecha("2026-08-19")!.getFullYear()).toBe(2026);
  });
  it("devuelve null en vez de una fecha inventada", () => {
    expect(parsearFecha("")).toBeNull();
    expect(parsearFecha("no es fecha")).toBeNull();
  });
});

describe("resolverColumnas", () => {
  const encabezadosComunicarte = [
    "¿Cuál es tu nombre completo?",
    "¿Cuál es tu correo electrónico?",
    "¿Cuál es tu número de WhatsApp?",
    "¿Cuánto ganas mensualmente? (en dólares)",
    "¿Qué te motivó a hacer parte del Método Comunicarte?",
    "¿Qué tan urgente es para ti empezar el programa?",
    "¿Cómo se podría describir mejor tu situación profesional?",
    "¿Estás dispuesto y en la capacidad de invertir 697 USD en ti?",
    "Agenda aquí tu entrevista",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "Submitted At", "Token", "Estado", "atribucion",
  ];

  const encabezadosTactical = [
    "¿Cuál es tu nombre completo?",
    "¿Cuál es tu correo electrónico?",
    "¿Cuál es tu número de WhatsApp?",
    "¿Cuánto ganas mensualmente? (en dólares)",
    "¿Qué te motivó a hacer parte del Programa de Cero a Tactical Investor?",
    "¿Qué tan urgente es para ti empezar el programa para aprender a invertir como un experto?",
    "¿Cómo se podría describir mejor tu situación profesional?",
    "¿Estás dispuesto y en la capacidad de invertir 1.500 USD en ti?",
    "Agenda aquí tu entrevista",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "Submitted At", "Token", "Estado",
  ];

  it("el mismo mapeo resuelve los dos programas pese a la redaccion distinta", () => {
    for (const encabezados of [encabezadosComunicarte, encabezadosTactical]) {
      const i = resolverColumnas(encabezados, MAPEO_FORMULARIO, OBLIGATORIOS_FORMULARIO);
      expect(i.emailNormalizado).toBe(1);
      expect(i.nombre).toBe(0);
      expect(i.telefono).toBe(2);
      expect(i.fechaAplicacion).toBe(14);
    }
  });

  it("ignora acentos y mayusculas al buscar el encabezado", () => {
    const i = resolverColumnas(["CORREO ELECTRONICO", "Submitted At"], MAPEO_FORMULARIO, []);
    expect(i.emailNormalizado).toBe(0);
  });

  it("falla ruidosamente si falta un campo obligatorio, en vez de adivinar", () => {
    expect(() =>
      resolverColumnas(["nombre", "telefono"], MAPEO_FORMULARIO, OBLIGATORIOS_FORMULARIO),
    ).toThrow(MapeoInvalidoError);
  });

  it("el error dice que busco y que encontro", () => {
    try {
      resolverColumnas(["columna rara"], MAPEO_FORMULARIO, ["emailNormalizado"]);
    } catch (e) {
      expect((e as Error).message).toContain("correo");
      expect((e as Error).message).toContain("columna rara");
    }
  });
});

describe("deduplicarPorCorreo", () => {
  it("una persona por correo, sin importar cuantas veces aplique", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026" },
      { emailNormalizado: "A@X.com", fechaAplicacion: "5/8/2026" },
      { emailNormalizado: " a@x.com ", fechaAplicacion: "9/8/2026" },
    ]);
    expect(personas).toHaveLength(1);
    expect(personas[0].numAplicaciones).toBe(3);
  });

  it("conserva la fecha MAS ANTIGUA como primera aplicacion", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "20/8/2026" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "3/8/2026" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "11/8/2026" },
    ]);
    expect(personas[0].fechaPrimeraAplicacion!.getDate()).toBe(3);
    expect(personas[0].fechaUltimaAplicacion!.getDate()).toBe(20);
  });

  it("una aplicacion posterior con campos vacios no borra lo que ya se sabia", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111", cargo: "Gerente" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "9/8/2026", telefono: "", cargo: "" },
    ]);
    expect(personas[0].telefono).toBe("300111");
    expect(personas[0].cargo).toBe("Gerente");
  });

  it("un valor nuevo mas reciente si reemplaza al anterior", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", cargo: "Analista" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "9/8/2026", cargo: "Gerente" },
    ]);
    expect(personas[0].cargo).toBe("Gerente");
  });

  it("descarta filas sin correo en vez de inventar personas", () => {
    const { personas, sinCorreo } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026" },
      { emailNormalizado: "", fechaAplicacion: "1/8/2026" },
      { emailNormalizado: "basura", fechaAplicacion: "1/8/2026" },
    ]);
    expect(personas).toHaveLength(1);
    expect(sinCorreo).toBe(2);
  });

  it("reproduce el ratio real de Tactical Investor: 2.954 filas -> 1.825 personas", () => {
    // Fixture sintetico con la distribucion descrita en PROJECT.md:
    // un correo con 12 aplicaciones, otro con 8, y el resto repartido.
    const filas: { emailNormalizado: string; fechaAplicacion: string }[] = [];
    const push = (email: string, veces: number) => {
      for (let i = 0; i < veces; i++) {
        filas.push({ emailNormalizado: email, fechaAplicacion: `${(i % 28) + 1}/8/2026` });
      }
    };
    push("heavy1@x.com", 12);
    push("heavy2@x.com", 8);
    // 1.823 personas mas, repartiendo las 2.934 filas restantes
    let restanFilas = 2954 - 20;
    let personas = 0;
    while (personas < 1823) {
      const quedanPersonas = 1823 - personas;
      const veces = restanFilas - quedanPersonas > 0 && personas % 2 === 0 ? 2 : 1;
      push(`p${personas}@x.com`, veces);
      restanFilas -= veces;
      personas++;
    }
    // Relleno lo que sobre en la primera pesada, sin crear personas nuevas
    if (restanFilas > 0) push("heavy1@x.com", restanFilas);

    const { personas: deducidas } = deduplicarPorCorreo(filas);
    expect(filas).toHaveLength(2954);
    expect(deducidas).toHaveLength(1825);
    const ratio = 1 - deducidas.length / filas.length;
    expect(ratio).toBeGreaterThan(0.37);
    expect(ratio).toBeLessThan(0.39);
  });
});

describe("filasDesdeMatriz", () => {
  it("mapea por indice y salta filas vacias", () => {
    const filas = filasDesdeMatriz(
      [
        ["Ana", "ana@x.com"],
        ["", ""],
        ["Beto", "beto@x.com"],
      ],
      { nombre: 0, emailNormalizado: 1 },
    );
    expect(filas).toHaveLength(2);
    expect(filas[1]).toEqual({ nombre: "Beto", emailNormalizado: "beto@x.com" });
  });
});
