import { describe, expect, it } from "vitest";
import { armarMensajeDeLaHora, nombresCortosDeCampanas } from "@/lib/reporte-whatsapp/mensaje";
import { NOTA_SIN_ERRORES, type MetricaSemaforo } from "@/lib/semaforo/semaforo";

const ORIGEN = "https://crm.test";
const METRICA: MetricaSemaforo = {
  metrica: "costo_por_agenda",
  color: "peligro",
  motivo: null,
  moneda: "COP",
  dia: "2026-10-16",
  gasto: 609860,
  agendasMeta: 2,
  agendasCrm: 4,
  costo: 304930,
  umbral: { meta: 200000, aceptable: 250000 },
  porcentajeDelUmbral: 152.5,
  comparacion: {
    dia: "2026-10-15",
    gasto: 300000,
    agendasMeta: 3,
    agendasCrm: 2,
    costo: 100000,
    etiqueta: "ayer a esta hora",
  },
  trayectoria: [
    { hora: "09:00", gasto: 0, agendasMeta: 0, agendasCrm: 0, costo: null },
    { hora: "11:00", gasto: 120000, agendasMeta: 1, agendasCrm: 2, costo: 120000 },
  ],
  racha: { color: "peligro", dias: 3 },
  campanas: [
    { codigo: "1001", nombre: "Ventas abiertas", gasto: 300000, agendasMeta: 2, costo: 150000, registrosMeta: null, costoPorRegistro: null, proposito: "agenda" },
    { codigo: "1002", nombre: "Retargeting", gasto: 200000, agendasMeta: 0, costo: null, registrosMeta: null, costoPorRegistro: null, proposito: "agenda" },
    { codigo: "1003", nombre: "Prospección amplia", gasto: 109860, agendasMeta: null, costo: null, registrosMeta: null, costoPorRegistro: null, proposito: "agenda" },
  ],
  lanzamiento: { gasto: 0, registrosMeta: null, costoPorRegistro: null, campanas: [] },
  gastoTotal: 609860,
  notas: [{ tipo: "problema", texto: "Creativo agotado" }],
};

function bloque() {
  return {
    programa: "Alpha",
    tipo: "dia" as const,
    enlaceHub: "https://hub.test/alpha",
    error: null,
    metricas: [METRICA],
    cuentasMeta: [],
  };
}

describe("mensaje del reporte por WhatsApp", () => {
  it("muestra nuevas, lanzamiento y total solo cuando corresponden", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{
        ...METRICA,
        campanas: [
          { ...METRICA.campanas[0], proposito: null },
          { ...METRICA.campanas[1], proposito: null },
        ],
        lanzamiento: {
          gasto: 322697,
          registrosMeta: 7,
          costoPorRegistro: 46099.57142857143,
          campanas: [{ codigo: "5102", nombre: "Registro Lanzamiento", gasto: 322697, agendasMeta: 0, costo: null, registrosMeta: 7, costoPorRegistro: 46099.57142857143, proposito: "lanzamiento" }],
        },
        gastoTotal: 932557,
      }],
    }], "09:00", null, ORIGEN);
    expect(mensaje).toContain([
      "🆕 Campañas nuevas: ¿agenda o lanzamiento?",
      "#1001 Ventas abiertas · $300.000 COP",
      "#1002 Retargeting · $200.000 COP",
      "👉 Responde citando este mensaje con el código y A (agenda) o L (lanzamiento), por ejemplo:",
      "1001 A, 1002 L",
    ].join("\n"));
    expect(mensaje).toContain("🚀 Lanzamiento: $322.697 COP · 7 registros Meta · CPL $46.100 COP\n• #5102 Registro Lanzamiento: $322.697 COP · 7 reg · $46.100 COP c/u");
    expect(mensaje).toContain("Gasto total del programa: $932.557 COP");
    const mensajeConUnaNueva = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{ ...METRICA, campanas: [{ ...METRICA.campanas[0], proposito: null }] }],
    }], "09:00", null, ORIGEN);
    expect(mensajeConUnaNueva).toContain("por ejemplo:\n1001 A\n");
    expect(armarMensajeDeLaHora([bloque()], "09:00", null, ORIGEN)).not.toContain("🚀 Lanzamiento");
  });

  it("distingue lanzamiento sin dato de lanzamiento con cero registros", () => {
    const campana = {
      codigo: "5102",
      nombre: "Registro Lanzamiento",
      gasto: 322697,
      agendasMeta: null,
      costo: null,
      registrosMeta: null,
      costoPorRegistro: null,
      proposito: "lanzamiento" as const,
    };
    const sinDato = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{
        ...METRICA,
        lanzamiento: { gasto: 322697, registrosMeta: null, costoPorRegistro: null, campanas: [campana] },
      }],
    }], "09:00", null, ORIGEN);
    expect(sinDato).toContain("🚀 Lanzamiento: $322.697 COP · registros Meta —");
    expect(sinDato).toContain("• #5102 Registro Lanzamiento: $322.697 COP · — reg");

    const conCero = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{
        ...METRICA,
        lanzamiento: {
          gasto: 322697,
          registrosMeta: 0,
          costoPorRegistro: null,
          campanas: [{ ...campana, registrosMeta: 0 }],
        },
      }],
    }], "09:00", null, ORIGEN);
    expect(conCero).toContain("🚀 Lanzamiento: $322.697 COP · 0 registros Meta · sin registros");
    expect(conCero).toContain("• #5102 Registro Lanzamiento: $322.697 COP · 0 reg · sin registros");
  });

  it("compacta umbral, gasto, ayer, rojo y problema en un bloque", () => {
    const mensaje = armarMensajeDeLaHora([bloque()], "09:00", null, ORIGEN);

    expect(mensaje).toBe([
      "🚦 Semáforo de pauta · 09:00 · 1🔴",
      "",
      "*Alpha*",
      "🔴 Costo por agenda: $304.930 COP · 53% más caro que la meta",
      "Meta $200.000 COP · aceptable $250.000 COP",
      "Gasto de agenda $609.860 COP · agendas Meta 2 · CRM 4",
      "• #1001 Ventas abiertas: $300.000 COP · 2 ag · $150.000 COP c/u",
      "• #1002 Retargeting: $200.000 COP · 0 ag · sin agendas",
      "• #1003 Prospección amplia: $109.860 COP · — ag · sin dato",
      "Ayer a esta hora: costo $100.000 COP · gasto $300.000 COP · agendas Meta 3 · CRM 2",
      "Días cerrados: 🔴 3 seguidos en rojo",
      "⚠️ Creativo agotado",
      "",
      "CRM: https://crm.test",
      "ℹ️ Las agendas de hoy pueden seguir subiendo: Meta las cuenta el día en que la persona vio el anuncio, aunque agende después.",
      "ℹ️ Costo por agenda = gasto de campañas de agenda ÷ agendas Meta (pixel); el lanzamiento va aparte. CPL de lanzamiento = gasto de lanzamiento ÷ registros Meta (pixel). CRM = citas con UTM de pauta.",
    ].join("\n"));
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });

  it("incluye la trayectoria completa al cierre", () => {
    const mensaje = armarMensajeDeLaHora(
      [{ ...bloque(), tipo: "cierre" }],
      "18:00",
      null,
      ORIGEN,
    );

    expect(mensaje).toMatch(/^🌙 Cierre del viernes 16-oct/);
    expect(mensaje).toMatch(/Trayectoria: 09:00 \$0 COP · 0 ag Meta \| 11:00 \$120\.000 COP · 1 ag Meta/);
    expect(mensaje).not.toContain("Las agendas de hoy pueden seguir subiendo");
  });

  it("avisa cada fuente cuya traza de pauta esta rota", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      trazaRota: [{
        fuente: "Typeform Tactical",
        pagos: 7,
        pagosSinId: 5,
        pagosSinFbclid: 0,
        sinId: true,
        fbclidRoto: false,
      }],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("⚠️ Typeform Tactical: 5 de 7 envíos pagos sin anuncio (24 h)");
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });

  it("muestra solo el aviso de fbclid cuando esa es la unica traza rota", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      trazaRota: [{
        fuente: "Typeform Tactical",
        pagos: 5,
        pagosSinId: 0,
        pagosSinFbclid: 5,
        sinId: false,
        fbclidRoto: true,
      }],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("⚠️ Typeform Tactical: 5 de 5 envíos pagos sin fbclid (24 h)");
    expect(mensaje).not.toContain("envíos pagos sin anuncio");
  });

  it("dice cuánto más barato que la meta, o igual", () => {
    const conPorcentaje = (porcentajeDelUmbral: number) => armarMensajeDeLaHora(
      [{ ...bloque(), metricas: [{ ...METRICA, color: "exito", porcentajeDelUmbral }] }],
      "09:00",
      null,
      ORIGEN,
    );

    expect(conPorcentaje(72.4)).toContain("🟢 Costo por agenda: $304.930 COP · 28% más barato que la meta");
    expect(conPorcentaje(100.2)).toContain("🟢 Costo por agenda: $304.930 COP · igual a la meta");
  });

  it("con gasto y cero agendas de Meta dice sin agendas, no sin dato", () => {
    const metrica: MetricaSemaforo = {
      ...METRICA,
      gasto: 63902,
      agendasMeta: 0,
      agendasCrm: 0,
      costo: null,
      porcentajeDelUmbral: null,
    };
    const mensaje = armarMensajeDeLaHora([{ ...bloque(), metricas: [metrica] }], "11:00", null, ORIGEN);

    expect(mensaje).toContain("🔴 Costo por agenda: sin agendas\n");
    expect(mensaje).toContain("Gasto de agenda $63.902 COP · agendas Meta 0 · CRM 0");
  });

  it("explica cuando falta cargar el umbral", () => {
    const metrica: MetricaSemaforo = {
      ...METRICA,
      color: "sin_dato",
      costo: null,
      umbral: null,
      motivo: "sin_umbral",
    };
    const mensaje = armarMensajeDeLaHora(
      [{ ...bloque(), metricas: [metrica] }],
      "09:00",
      null,
      ORIGEN,
    );

    expect(mensaje).toMatch(/⚪ Costo por agenda: sin dato/);
    expect(mensaje).toMatch(/Falta cargar la meta en el CRM/);
  });

  it("muestra una sola vez la sincronizacion y termina con el CRM general", () => {
    const mensaje = armarMensajeDeLaHora([bloque(), { ...bloque(), programa: "Beta" }], "09:00", {
      estado: "error",
      ultimaFoto: "2026-07-14T15:27:00Z",
    }, ORIGEN);

    expect(mensaje.match(/⚠️ No se pudo leer Meta/g)).toHaveLength(1);
    expect(mensaje).toContain("⚠️ No se pudo leer Meta; cifras de la última foto (10:27)");
    expect(mensaje).toContain("CRM: https://crm.test");
  });

  it("une dos programas, deduplica la info y confirma una corrida limpia", () => {
    const textoHQ4 = "HQ-4: Meta entregó datos parciales";
    const metricaLimpia: MetricaSemaforo = {
      ...METRICA,
      notas: [
        { tipo: "info", texto: textoHQ4 },
        { tipo: "info", texto: NOTA_SIN_ERRORES },
      ],
    };
    const primero = { ...bloque(), metricas: [metricaLimpia] };
    const segundo = { ...primero, programa: "Beta", enlaceHub: "https://hub.test/beta" };
    const mensaje = armarMensajeDeLaHora([primero, segundo], "09:00", null, ORIGEN);

    expect(mensaje.match(/🚦 Semáforo de pauta · 09:00 · 2🔴/g)).toHaveLength(1);
    expect(mensaje.match(/━━━━━━━━━━/g)).toHaveLength(1);
    expect(mensaje).toContain("*Alpha*\n🔴 Costo por agenda");
    expect(mensaje).toContain("\n━━━━━━━━━━\n*Beta*\n");
    expect(mensaje.match(new RegExp(textoHQ4, "g"))).toHaveLength(1);
    expect(mensaje).toContain(`ℹ️ ${textoHQ4}\n✅ Sin errores en esta corrida`);
    expect(mensaje).toContain("CRM: https://crm.test");
  });

  it("resume todas las cuentas de Meta al dia", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{ ...METRICA, notas: [] }],
      cuentasMeta: [
        { nombre: "Cuenta uno", estado: "al_dia", detalle: null },
        { nombre: "Cuenta dos", estado: "al_dia", detalle: null },
      ],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("💳 Cuentas de Meta: todas al día (2)");
  });

  it("lista las cuentas de Meta con problema y elimina la confirmacion limpia", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{ ...METRICA, notas: [] }],
      cuentasMeta: [
        { nombre: "Cuenta sana", estado: "al_dia", detalle: null },
        { nombre: "Cuenta cobros", estado: "problema", detalle: "pago pendiente" },
      ],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("💳 Cuentas de Meta con problema:\n🔴 Cuenta cobros (Alpha): pago pendiente");
    expect(mensaje).not.toContain("Cuenta sana (Alpha)");
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });

  it("marca solo el bloque de cierre cuando mezcla tipos", () => {
    const mensaje = armarMensajeDeLaHora([
      bloque(),
      { ...bloque(), programa: "Beta", tipo: "cierre" },
    ], "18:00", null, ORIGEN);

    expect(mensaje).toMatch(/^🚦 Semáforo de pauta · 18:00 · 2🔴/);
    expect(mensaje).toContain("*Alpha*\n");
    expect(mensaje).toContain("*Beta* (cierre)\n");
  });

  it("dice sin foto cuando no existe comparación", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{ ...METRICA, comparacion: null }],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("Ayer a esta hora: sin foto");
    expect(mensaje).not.toContain("Ayer a esta hora: $0");
  });

  it("un error reemplaza las metricas del programa y elimina la confirmacion", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      error: "No se pudo calcular el semáforo de este programa.",
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("*Alpha*\n⚠️ No se pudo calcular el semáforo de este programa.");
    expect(mensaje).not.toContain("🔴 Costo por agenda:");
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });
});

describe("nombres cortos de campaña", () => {
  it("quita las piezas que comparten más de la mitad de las campañas", () => {
    expect(nombresCortosDeCampanas([
      "AS | CBO | Invite | Metodo Comunicarte | Oct 2026 | Collab",
      "Metodo_Comunicarte_Rosario_Agendamiento_Llamada",
      "AS | CBO | Invite | Metodo Comunicarte | Oct 2026",
      "AS | ABO | Metodo Comunicarte | Direct TypeForm | Sept 2026",
    ])).toEqual([
      "CBO · Invite · Oct 2026 · Collab",
      "Metodo · Comunicarte · Rosario · Agenda…",
      "CBO · Invite · Oct 2026",
      "ABO · Direct TypeForm · Sept 2026",
    ]);
    expect(nombresCortosDeCampanas([
      "AS | CBO | Invite | Power Talk | Oct 2026 | Pub Orig - Copia",
      "AS | CBO | Invite | Power Talk | Oct 2026 | Pub Orig",
    ])).toEqual(["Pub Orig - Copia", "Pub Orig"]);
  });

  it("compara sin mayúsculas ni tildes", () => {
    expect(nombresCortosDeCampanas(["Campaña | Uno", "campana | Dos"])).toEqual(["Uno", "Dos"]);
  });

  it("vuelve al nombre completo si queda vacío o repetido, siempre cortado a 40", () => {
    expect(nombresCortosDeCampanas([
      "AS | Mismo",
      "AS | Mismo",
      "Una campaña con un nombre larguísimo sin separadores",
    ])).toEqual(["AS | Mismo", "AS | Mismo", "Una campaña con un nombre larguísimo si…"]);
  });

  it("con una sola campaña con codigo muestra el desglose para poder corregirla", () => {
    const mensaje = armarMensajeDeLaHora([{
      programa: "Tactical",
      tipo: "dia",
      enlaceHub: "https://crm.test/p/tactical/hub?seccion=pauta",
      metricas: [{
        ...METRICA,
        campanas: [{ codigo: "1234", nombre: "AS | CBO | Única", gasto: 609860, agendasMeta: 2, costo: 304930, registrosMeta: null, costoPorRegistro: null, proposito: "agenda" }],
      }],
      cuentasMeta: [],
      error: null,
    }], "11:00", null, ORIGEN);
    // Con una sola campaña ninguna pieza distingue, así que va el nombre completo.
    expect(mensaje).toContain("• #1234 AS | CBO | Única: $609.860 COP · 2 ag · $304.930 COP c/u");
  });
});
