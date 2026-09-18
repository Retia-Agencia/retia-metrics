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

/**
 * Las aserciones van sobre toISOString y no sobre getDate()/getMonth(), que son
 * getters locales: con esos, el mismo test pasa o falla segun la zona de la maquina
 * que lo corre, que es justo el defecto que F-05 arregla.
 */
describe("parsearFecha", () => {
  it("lee el formato colombiano d/m/yyyy en hora de Colombia, no m/d", () => {
    // 7 de agosto 14:30 en Bogota (UTC-5) = 19:30 UTC. No 8 de julio.
    expect(parsearFecha("7/8/2026 14:30:00")!.toISOString()).toBe("2026-08-07T19:30:00.000Z");
  });

  it("distingue dias que serian ambiguos", () => {
    // 3 de diciembre 00:00 en Bogota = 05:00 UTC del 3. No 12 de marzo.
    expect(parsearFecha("3/12/2026")!.toISOString()).toBe("2026-12-03T05:00:00.000Z");
  });

  it("no depende de la zona horaria del proceso", () => {
    // F-05: la maquina de Michael es UTC-5 y una funcion de Vercel es UTC. El mismo
    // texto tiene que dar el mismo instante en las dos, porque la columna destino es
    // timestamptz y "ritmo por dia habil" es una de las metricas centrales.
    // Una aplicacion de las 19:30 cae en el dia siguiente en UTC: es el caso que
    // movia un lead de dia habil.
    expect(parsearFecha("12/8/2026 19:30:00")!.toISOString()).toBe("2026-08-13T00:30:00.000Z");
  });

  it("acepta ISO", () => {
    expect(parsearFecha("2026-08-19")!.getUTCFullYear()).toBe(2026);
  });

  it("devuelve null en vez de una fecha inventada", () => {
    expect(parsearFecha("")).toBeNull();
    expect(parsearFecha("no es fecha")).toBeNull();
  });

  /**
   * 18-sep: la hoja de Tactical trae `1/1/0001 0:00:00` como centinela de "vacio".
   * Es una fecha SINTACTICAMENTE valida, asi que se parseaba sin error y entraba a
   * la base como el 1 de enero del ano 1. Resultado: 1.034 de 2.622 personas (39%)
   * fuera de todo rango de fechas, invisibles como lead, sin que nada fallara.
   *
   * Un centinela no es una fecha: es la ausencia de una. El piso son dos ordenes de
   * magnitud mas holgado que el dato real mas viejo (2026-06-17), asi que no puede
   * descartar nada legitimo, y ataja tambien el cero de las hojas de calculo
   * (30/12/1899), que es el otro centinela de la familia.
   */
  it("un centinela de 'vacio' es null, no una fecha del ano 1", () => {
    expect(parsearFecha("1/1/0001 0:00:00")).toBeNull();
    expect(parsearFecha("1/1/0001")).toBeNull();
    expect(parsearFecha("0001-01-01T00:00:00")).toBeNull();
    // El cero de Excel y de Google Sheets.
    expect(parsearFecha("30/12/1899")).toBeNull();
  });

  it("el piso no se come ninguna fecha real", () => {
    // La mas vieja de la base real es 2026-06-17; el piso esta en el ano 2000.
    expect(parsearFecha("17/6/2026")!.getUTCFullYear()).toBe(2026);
    expect(parsearFecha("1/1/2000")!.getUTCFullYear()).toBe(2000);
  });
});

describe("resolverColumnas", () => {
  /**
   * F-09: ganaba el PRIMER encabezado que CONTUVIERA el patron. La mayoria de los
   * patrones son largos y especificos, pero `estado: "estado"` es una sola palabra:
   * con "Estado" y "Estado de la llamada" en la misma hoja, el mapeo agarraba el
   * que estuviera mas a la izquierda y nadie se enteraba. Es justo la columna de la
   * que depende el embudo.
   */
  it("prefiere el encabezado exacto sobre el que solo contiene el patron", () => {
    const i = resolverColumnas(
      ["Estado de la llamada", "Correo electronico", "Estado"],
      { estado: "estado", emailNormalizado: "correo electronico" },
    );
    expect(i.estado).toBe(2);
  });

  it("sigue cayendo a coincidencia parcial cuando no hay exacta", () => {
    const i = resolverColumnas(["¿Cual es tu nombre completo?"], { nombre: "nombre completo" });
    expect(i.nombre).toBe(0);
  });

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

  /**
   * El dano real del centinela, y es peor que el caso de arriba: "la mas antigua
   * gana" hace que el ano 1 le gane SIEMPRE a una fecha de verdad. Una sola fila
   * envenenada le borraba la primera aplicacion a una persona que si tenia filas
   * buenas. En `production` eso le paso a 704 personas con 2+ aplicaciones, de las
   * 1.034 afectadas en total.
   *
   * No hace falta tocar el dedup: con `parsearFecha` devolviendo null, la fila
   * envenenada pasa a ser "una fila sin fecha", que es un caso que el dedup ya
   * resuelve bien desde F-02.
   */
  it("una fila con centinela no le borra la primera aplicacion a quien si la tiene", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "20/8/2026" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/1/0001 0:00:00" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "3/8/2026" },
    ]);
    expect(personas[0].fechaPrimeraAplicacion!.getFullYear()).toBe(2026);
    expect(personas[0].fechaPrimeraAplicacion!.getDate()).toBe(3);
    expect(personas[0].fechaUltimaAplicacion!.getDate()).toBe(20);
    // Sigue contando como aplicacion: lo que falta es la fecha, no la solicitud.
    expect(personas[0].numAplicaciones).toBe(3);
  });

  it("si TODAS sus filas traen centinela, se queda sin fecha (null), no en el ano 1", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/1/0001 0:00:00" },
    ]);
    expect(personas[0].fechaPrimeraAplicacion).toBeNull();
    expect(personas[0].numAplicaciones).toBe(1);
  });

  it("una aplicacion posterior con campos vacios no borra lo que ya se sabia", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111", cargo: "Gerente" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "9/8/2026", telefono: "", cargo: "" },
    ]);
    expect(personas[0].telefono).toBe("300111");
    expect(personas[0].cargo).toBe("Gerente");
  });

  /**
   * F-02: `esMasReciente` empezaba con `!fecha ||`, o sea "si esta fila no tiene
   * fecha parseable, tratala como la mas reciente". Sus valores pisaban los de la
   * aplicacion buena anterior. parsearFecha devuelve null para una celda vacia, un
   * numero de serie de Sheets o "19 ago 2026", y fechaAplicacion es obligatoria a
   * nivel de columna pero no de valor, asi que la fila entra igual.
   */
  it("una fila sin fecha parseable no pisa lo que ya se sabia", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111", cargo: "Gerente" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "", telefono: "999999", cargo: "Otro" },
    ]);
    expect(personas[0].telefono).toBe("300111");
    expect(personas[0].cargo).toBe("Gerente");
  });

  it("pero una fila sin fecha si rellena un hueco que estaba vacio", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111" },
      { emailNormalizado: "a@x.com", fechaAplicacion: "", cargo: "Analista" },
    ]);
    expect(personas[0].telefono).toBe("300111");
    expect(personas[0].cargo).toBe("Analista");
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
    // Fixture sintetico con la distribucion de Tactical Investor C1
    // (ver docs/agents/handoff.md, datos de validacion):
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
