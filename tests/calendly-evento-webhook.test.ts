import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  leerEventoDeCalendly,
  uuidDeInvitado,
  verificarFirmaCalendly,
  TOLERANCIA_FIRMA_MS,
} from "@/lib/calendly/evento-webhook";

/**
 * Lo puro del webhook de Calendly (ticket 096, A5): la firma y la lectura del evento. El
 * formato sale de la documentacion de Calendly y falta confirmarlo con una entrega real;
 * si difiere, se corrige el modulo y este test, nada mas.
 */

const CLAVE = "clave-de-firma-de-prueba";
const AHORA = new Date("2026-09-28T20:00:00.000Z");
const T = Math.floor(AHORA.getTime() / 1000);

function firmar(cuerpo: string, t = T, clave = CLAVE): string {
  return `t=${t},v1=${createHmac("sha256", clave).update(`${t}.${cuerpo}`, "utf8").digest("hex")}`;
}

const INVITADO = "https://api.calendly.com/scheduled_events/EV1/invitees/INV-NUEVO";

function evento(event: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ event, created_at: AHORA.toISOString(), payload });
}

const CREADO = {
  uri: INVITADO,
  email: "Ana@Correo.co",
  name: "Ana Pérez",
  text_reminder_number: "+57 300 123 4567",
  tracking: { utm_content: "0123456789abcdef0123456789abcdef" },
  rescheduled: false,
  old_invitee: null,
  scheduled_event: {
    start_time: "2026-10-02T15:00:00.000000Z",
    event_memberships: [{ user_email: "Maru.Tactical@calendly.co" }],
  },
};

describe("verificarFirmaCalendly", () => {
  const cuerpo = evento("invitee.created", CREADO);

  it("acepta la firma de este cuerpo con esta clave", () => {
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo), CLAVE, AHORA)).toBe("valida");
  });

  it("distingue ausente de invalida", () => {
    expect(verificarFirmaCalendly(cuerpo, null, CLAVE, AHORA)).toBe("ausente");
    expect(verificarFirmaCalendly(cuerpo, "basura", CLAVE, AHORA)).toBe("invalida");
  });

  it("rechaza otra clave, un cuerpo tocado y un v1 truncado", () => {
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo, T, "otra"), CLAVE, AHORA)).toBe("invalida");
    expect(verificarFirmaCalendly(cuerpo + " ", firmar(cuerpo), CLAVE, AHORA)).toBe("invalida");
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo).slice(0, -2), CLAVE, AHORA)).toBe("invalida");
  });

  it("rechaza una firma vieja (repeticion) o del futuro, fuera de la tolerancia", () => {
    const margen = TOLERANCIA_FIRMA_MS / 1000;
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo, T - margen + 5), CLAVE, AHORA)).toBe("valida");
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo, T - margen - 5), CLAVE, AHORA)).toBe("invalida");
    expect(verificarFirmaCalendly(cuerpo, firmar(cuerpo, T + margen + 5), CLAVE, AHORA)).toBe("invalida");
  });
});

describe("leerEventoDeCalendly", () => {
  it("invitee.created: uuid, fecha, correos y sin reagenda", () => {
    expect(leerEventoDeCalendly(evento("invitee.created", CREADO))).toEqual({
      ok: true,
      evento: {
        tipo: "agendada",
        uuidInvitado: "INV-NUEVO",
        inicio: new Date("2026-10-02T15:00:00.000Z"),
        correoInvitado: "Ana@Correo.co",
        correoHost: "maru.tactical@calendly.co",
        utmContent: "0123456789abcdef0123456789abcdef",
        nombreInvitado: "Ana Pérez",
        telefonoInvitado: "+57 300 123 4567",
        uuidAnterior: null,
        claveEvento: "invitee.created:2026-09-28T20:00:00.000Z:INV-NUEVO",
      },
    });
  });

  it("la mitad nueva de una reagenda trae el uuid viejo", () => {
    const l = leerEventoDeCalendly(
      evento("invitee.created", { ...CREADO, old_invitee: "https://api.calendly.com/scheduled_events/EV0/invitees/INV-VIEJO" }),
    );
    expect(l.ok && l.evento.tipo === "agendada" && l.evento.uuidAnterior).toBe("INV-VIEJO");
  });

  it("dos hosts no deciden dueño", () => {
    const l = leerEventoDeCalendly(
      evento("invitee.created", {
        ...CREADO,
        scheduled_event: { ...CREADO.scheduled_event, event_memberships: [{ user_email: "a@x.co" }, { user_email: "b@x.co" }] },
      }),
    );
    expect(l.ok && l.evento.tipo === "agendada" && l.evento.correoHost).toBeNull();
  });

  it("invitee.canceled distingue la cancelacion de la mitad vieja de una reagenda", () => {
    expect(leerEventoDeCalendly(evento("invitee.canceled", { uri: INVITADO, rescheduled: false }))).toEqual({
      ok: true,
      evento: { tipo: "cancelada", uuidInvitado: "INV-NUEVO", reagendada: false, claveEvento: "invitee.canceled:2026-09-28T20:00:00.000Z:INV-NUEVO" },
    });
    expect(leerEventoDeCalendly(evento("invitee.canceled", { uri: INVITADO, rescheduled: true }))).toEqual({
      ok: true,
      evento: { tipo: "cancelada", uuidInvitado: "INV-NUEVO", reagendada: true, claveEvento: "invitee.canceled:2026-09-28T20:00:00.000Z:INV-NUEVO" },
    });
  });

  it("no-show: el invitado sale de `uri` o, si la uri es del no-show, de `invitee`", () => {
    expect(leerEventoDeCalendly(evento("invitee_no_show.created", { uri: INVITADO }))).toEqual({
      ok: true,
      evento: { tipo: "no_show", uuidInvitado: "INV-NUEVO", claveEvento: "invitee_no_show.created:2026-09-28T20:00:00.000Z:INV-NUEVO" },
    });
    expect(
      leerEventoDeCalendly(
        evento("invitee_no_show.deleted", { uri: "https://api.calendly.com/invitee_no_shows/NS1", invitee: INVITADO }),
      ),
    ).toEqual({ ok: true, evento: { tipo: "no_show_retirado", uuidInvitado: "INV-NUEVO", claveEvento: "invitee_no_show.deleted:2026-09-28T20:00:00.000Z:INV-NUEVO" } });
  });

  it("un evento que no se escucha se ignora, no es un error", () => {
    expect(leerEventoDeCalendly(evento("routing_form_submission.created", {}))).toEqual({
      ok: true,
      evento: { tipo: "ignorado", evento: "routing_form_submission.created" },
    });
  });

  it("lo que no se entiende vuelve como error, sin lanzar", () => {
    expect(leerEventoDeCalendly("no es json").ok).toBe(false);
    expect(leerEventoDeCalendly(JSON.stringify({ event: "invitee.created" })).ok).toBe(false);
    expect(leerEventoDeCalendly(evento("invitee.canceled", { uri: "https://api.calendly.com/users/U1" })).ok).toBe(false);
    expect(
      leerEventoDeCalendly(evento("invitee.created", { ...CREADO, scheduled_event: { start_time: "mañana" } })).ok,
    ).toBe(false);
  });

  it("exige created_at porque es la identidad durable que separa ciclos legítimos", () => {
    const sinInstante = JSON.stringify({ event: "invitee_no_show.created", payload: { uri: INVITADO } });
    expect(leerEventoDeCalendly(sinInstante)).toEqual({
      ok: false,
      error: "El evento invitee_no_show.created no trae created_at válido.",
    });
  });
});

describe("uuidDeInvitado", () => {
  it("toma el segmento despues de `invitees`, y nada si no hay", () => {
    expect(uuidDeInvitado(INVITADO)).toBe("INV-NUEVO");
    expect(uuidDeInvitado("https://api.calendly.com/users/U1")).toBeNull();
    expect(uuidDeInvitado(null)).toBeNull();
  });
});
