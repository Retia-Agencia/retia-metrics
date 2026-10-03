import { describe, expect, it } from "vitest";
import {
  ETAPAS,
  NOMBRE_DE_ETAPA,
  NOMBRE_DE_PENDIENTE,
  TRANSICIONES,
  TRANSICIONES_PENDIENTE,
  transicion,
  transicionPendiente,
  unaCitaMueveAAgendado,
  type EtapaDeal,
  type PendienteDeal,
} from "@/lib/deals/etapas";
import {
  PREGUNTA_DE_ETAPA,
  queHace,
  respuestasDe,
  respuestasHacia,
  respuestasPorDestino,
  type PreguntaDeEtapa,
  type Respuesta,
} from "@/components/deals/pregunta-de-etapa";

type Tabla = Readonly<Record<EtapaDeal, PreguntaDeEtapa>>;

/**
 * Las flechas que una persona puede tomar y que NINGUNA pregunta ofrece, cada una con su
 * razon. Una flecha nueva del motor que nadie ofrece hace fallar el test hasta que se
 * agregue una respuesta o se nombre aqui.
 */
const SIN_RESPUESTA: Record<string, string> = {
  // Con un contacto registrado el deal ya pasó solo a Contactado (E2): no hay caso real.
  "E3 en_gestion>calificado": "E2 se adelanta",
  // Antes de Calificado la cita la trae Calendly, no una pregunta (ADR 0072 punto 1).
  "E4 potencial>agendado": "la trae Calendly",
  "E4 registrado>agendado": "la trae Calendly",
  "E4 en_gestion>agendado": "la trae Calendly",
  "E4 contactado>agendado": "la trae Calendly",
  // Un deal cerrado no recibe llamadas, así que no hay cita con la que volver a Agendado:
  // se recupera a En gestión y desde ahí se agenda.
  "R cierre_perdido>agendado": "un deal cerrado no recibe llamadas",
};

const etapaClave = (id: string, de: EtapaDeal, a: EtapaDeal) => `${id} ${de}>${a}`;
const pendienteClave = (id: string, etapa: EtapaDeal, pone: PendienteDeal) => `${id} ${etapa}+${pone}`;

/** Los problemas entre la tabla de preguntas y el motor; vacio = coinciden. */
function desajustes(tabla: Tabla): string[] {
  const problemas: string[] = [];
  const alcanzadas = new Set<string>();

  for (const etapa of ETAPAS) {
    for (const r of tabla[etapa].respuestas) {
      const pendienteAntes: PendienteDeal | null = r.soloConPendiente ? "reagenda" : null;
      const donde = `${etapa}/${r.id}`;
      const a = r.accion;
      if (a.tipo === "mover" && a.a !== etapa) {
        const t = transicion(etapa, a.a);
        if (!t || t.quien === "sistema") problemas.push(`${donde}: no hay flecha de persona a ${a.a}`);
        else if (a.pendiente != null) problemas.push(`${donde}: cambiar de etapa no pone pendiente`);
        else alcanzadas.add(etapaClave(t.id, etapa, a.a));
      } else if (a.tipo === "mover") {
        const t = a.pendiente ? transicionPendiente(etapa, a.pendiente) : null;
        if (!t || t.quien === "sistema") problemas.push(`${donde}: no hay flecha de pendiente ${a.pendiente}`);
        else alcanzadas.add(pendienteClave(t.id, etapa, a.pendiente!));
      } else if (a.tipo === "retroceder") {
        for (const destino of a.destinos) {
          const t = transicion(etapa, destino);
          if (t?.id !== "RETRO") problemas.push(`${donde}: ${destino} no es un retroceso`);
          else alcanzadas.add(etapaClave("RETRO", etapa, destino));
        }
        const reales = TRANSICIONES.filter((t) => t.id === "RETRO" && t.de === etapa).map((t) => t.a);
        if ([...reales].sort().join() !== [...a.destinos].sort().join()) problemas.push(`${donde}: destinos distintos del motor`);
      } else if (a.tipo === "llamada" && a.uso === "agendar") {
        if (!unaCitaMueveAAgendado(etapa, pendienteAntes)) problemas.push(`${donde}: una cita no mueve desde aquí`);
        const t = transicion(etapa, "agendado");
        if (t) alcanzadas.add(etapaClave(t.id, etapa, "agendado"));
      } else if (a.tipo === "llamada") {
        if (etapa !== "agendado") problemas.push(`${donde}: solo una cita agendada se reprograma o falla`);
        if (a.uso === "reprogramar") alcanzadas.add(etapaClave("E7", etapa, etapa));
      } else if (a.tipo === "actividad") {
        if (!["potencial", "registrado", "en_gestion"].includes(etapa)) problemas.push(`${donde}: la actividad no mueve desde aquí`);
      } else if (a.tipo === "abono") {
        if (!TRANSICIONES.some((t) => t.de === etapa && (t.a === "ganado_parcial" || t.a === "ganado_completo"))) {
          problemas.push(`${donde}: desde aquí no se entra a ganado`);
        }
      }
    }
  }

  for (const t of TRANSICIONES) {
    if (t.quien === "sistema") continue;
    const clave = etapaClave(t.id, t.de, t.a);
    if (!alcanzadas.has(clave) && !(clave in SIN_RESPUESTA)) problemas.push(`sin respuesta: ${clave}`);
  }
  for (const t of TRANSICIONES_PENDIENTE) {
    if (t.quien === "sistema" || t.pone == null) continue;
    const clave = pendienteClave(t.id, t.etapa, t.pone);
    if (!alcanzadas.has(clave)) problemas.push(`sin respuesta: ${clave}`);
  }
  return problemas;
}

const sin = (tabla: Tabla, etapa: EtapaDeal, id: string): Tabla => ({
  ...tabla,
  [etapa]: { ...tabla[etapa], respuestas: tabla[etapa].respuestas.filter((r) => r.id !== id) },
});
const con = (tabla: Tabla, etapa: EtapaDeal, r: Respuesta): Tabla => ({
  ...tabla,
  [etapa]: { ...tabla[etapa], respuestas: [...tabla[etapa].respuestas, r] },
});

describe("la pregunta de cada etapa coincide con el motor (ADR 0072)", () => {
  it("toda respuesta es una flecha de persona, y toda flecha de persona tiene respuesta", () => {
    expect(desajustes(PREGUNTA_DE_ETAPA)).toEqual([]);
  });

  it("quitar una respuesta deja su flecha sin respuesta", () => {
    expect(desajustes(sin(PREGUNTA_DE_ETAPA, "contactado", "califica"))).toContain("sin respuesta: E3 contactado>calificado");
    expect(desajustes(sin(PREGUNTA_DE_ETAPA, "atendido", "otra_llamada"))).toContain("sin respuesta: PR2 atendido+reagenda");
    expect(desajustes(sin(PREGUNTA_DE_ETAPA, "contactado", "negocia"))).toContain("sin respuesta: E5 contactado>compromiso_verbal");
  });

  it("una respuesta hacia una flecha que no existe, o que es del sistema, se rechaza", () => {
    const inventada: Respuesta = { id: "x", etiqueta: "x", accion: { tipo: "mover", a: "ganado_completo", pendiente: null } };
    expect(desajustes(con(PREGUNTA_DE_ETAPA, "registrado", inventada))).toContain("registrado/x: no hay flecha de persona a ganado_completo");
    const delSistema: Respuesta = { id: "y", etiqueta: "y", accion: { tipo: "mover", a: "agendado", pendiente: "reagenda" } };
    expect(desajustes(con(PREGUNTA_DE_ETAPA, "agendado", delSistema))).toContain("agendado/y: no hay flecha de pendiente reagenda");
  });

  it("las excepciones nombradas son flechas que existen de verdad", () => {
    const reales = new Set(TRANSICIONES.map((t) => etapaClave(t.id, t.de, t.a)));
    for (const clave of Object.keys(SIN_RESPUESTA)) expect(reales.has(clave), clave).toBe(true);
  });

  it("Descartar es la última respuesta donde se puede perder, y Ganado Pagado Completo no pregunta nada", () => {
    for (const etapa of ETAPAS) {
      const ids = PREGUNTA_DE_ETAPA[etapa].respuestas.map((r) => r.id);
      expect(ids.at(-1) === "descartar", etapa).toBe(transicion(etapa, "cierre_perdido") != null);
    }
    expect(PREGUNTA_DE_ETAPA.ganado_completo.respuestas).toEqual([]);
  });
});

describe("respuestasDe: lo que depende del pendiente", () => {
  it("en Atendido, Agendó solo aparece con un pendiente (E9)", () => {
    expect(respuestasDe("atendido", null).map((r) => r.id)).not.toContain("agendo");
    expect(respuestasDe("atendido", "seguimiento").map((r) => r.id)).toContain("agendo");
  });

  it("en Agendado, Próxima cohorte solo aparece con un pendiente (PC)", () => {
    expect(respuestasDe("agendado", null).map((r) => r.id)).not.toContain("proxima_cohorte");
    expect(respuestasDe("agendado", "reagenda").map((r) => r.id)).toContain("proxima_cohorte");
  });
});

describe("respuestasHacia: soltar en una columna del Kanban (ADR 0072 punto 2)", () => {
  const ids = (rs: Respuesta[]) => rs.map((r) => r.id);

  it("una flecha directa abre su respuesta ya elegida", () => {
    expect(ids(respuestasHacia("contactado", null, "calificado"))).toEqual(["califica"]);
    expect(ids(respuestasHacia("agendado", null, "atendido"))).toEqual(["termino"]);
  });

  it("a ganado solo se entra con un abono", () => {
    expect(ids(respuestasHacia("atendido", null, "ganado_completo"))).toEqual(["abono"]);
    expect(ids(respuestasHacia("agendado", null, "ganado_parcial"))).toEqual([]);
  });

  it("el retroceso aparece en las tres columnas a las que el motor puede volver", () => {
    for (const columna of ["atendido", "contactado", "calificado"] as const) {
      expect(ids(respuestasHacia("compromiso_verbal", null, columna))).toEqual(["retroceso"]);
    }
  });

  it("desde Registrado, soltar en En gestión deja escoger entre contacto e intento", () => {
    expect(ids(respuestasHacia("registrado", null, "en_gestion"))).toEqual(["contacto", "intento"]);
    expect(ids(respuestasHacia("en_gestion", null, "en_gestion"))).toEqual([]);
  });

  it("sin flecha hacia la columna, o en la misma columna, no hay respuesta y la tarjeta vuelve", () => {
    expect(respuestasHacia("potencial", null, "atendido")).toEqual([]);
    expect(respuestasHacia("calificado", null, "calificado")).toEqual([]);
    expect(ids(respuestasHacia("atendido", null, "agendado"))).toEqual([]);
    expect(ids(respuestasHacia("atendido", "reagenda", "agendado"))).toEqual(["agendo"]);
  });
});

describe("respuestasPorDestino: Transición (ADR 0075)", () => {
  it("explica todas las respuestas y nombra el mismo destino que su grupo", () => {
    for (const etapa of ETAPAS) {
      const grupos = respuestasPorDestino(etapa, "reagenda", ETAPAS);
      for (const respuesta of respuestasDe(etapa, "reagenda")) {
        const texto = queHace(etapa, "reagenda", respuesta, ETAPAS, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE);
        expect(texto, `${etapa}/${respuesta.id}`).not.toBe("");
        const grupo = grupos.destinos.find((candidato) => candidato.respuestas.includes(respuesta));
        if (grupo) {
          const nombre = grupo.destino === "ganado" ? "Ganado" : NOMBRE_DE_ETAPA[grupo.destino];
          expect(texto, `${etapa}/${respuesta.id}`).toContain(nombre);
        }
      }
    }
    for (const accion of ["contacto", "intento", "nota"] as const) {
      expect(queHace("atendido", null, accion, ETAPAS, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE)).not.toBe("");
    }
  });

  it("cada respuesta que cambia de etapa cae en exactamente un botón", () => {
    for (const etapa of ETAPAS) {
      const grupos = respuestasPorDestino(etapa, "reagenda", ETAPAS);
      const agrupadas = grupos.destinos.flatMap((grupo) => grupo.respuestas);
      for (const respuesta of respuestasDe(etapa, "reagenda")) {
        const cambia = respuesta.accion.tipo === "abono"
          || ETAPAS.some((destino) => destino !== etapa && respuestasHacia(etapa, "reagenda", destino).includes(respuesta));
        expect(agrupadas.filter((r) => r === respuesta), `${etapa}/${respuesta.id}`).toHaveLength(cambia ? 1 : 0);
      }
    }
  });

  it("Pago Parcial y Completo forman un solo destino Ganado", () => {
    const grupos = respuestasPorDestino("atendido", null, ETAPAS);
    expect(grupos.destinos.filter((grupo) => grupo.destino === "ganado")).toMatchObject([
      { respuestas: [{ id: "abono" }] },
    ]);
  });
});
