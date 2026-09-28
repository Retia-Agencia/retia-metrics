import { describe, expect, it, vi } from "vitest";
import {
  citaDeCalendly,
  ErrorDeCalendly,
  uuidInvitadoDelLink,
  type FetchLike,
} from "@/lib/calendly/cita";

/**
 * Ticket 109 (ADR 0057 punto 4) + ticket 052: leer la cita real de Calendly con su
 * estado.
 *  - El emparejamiento es por UUID de invitado, exacto, nunca solo por correo.
 *  - Un uuid que no aparece devuelve null (la cita no se inventa).
 *  - Una cita con el evento o el invitado en `canceled` devuelve `cancelada: true`.
 *  - Un 401/403/5xx o una respuesta rara lanza un error visible, nunca null.
 *  - Cero red: `fetch` es falso.
 */

const ORG = "https://api.calendly.com/organizations/ORG1";
const EVENT_URI = "https://api.calendly.com/scheduled_events/EV1";

/** Una respuesta JSON ok con el cuerpo dado. */
function ok(cuerpo: unknown) {
  return { ok: true, status: 200, json: async () => cuerpo };
}

/** Una respuesta de error con el status dado. */
function fallo(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

/**
 * Un fetch falso guiado por la URL. Cubre las tres llamadas del flujo:
 * /users/me, /scheduled_events y <event>/invitees. Se prueba primero `/invitees`
 * porque la URI del evento CONTIENE `/scheduled_events/`, y sin ese orden el
 * listado de invitados devolveria por error la coleccion de eventos.
 */
function fetchFalso(mapa: Record<string, unknown>): FetchLike {
  return vi.fn(async (url: string) => {
    if (url.includes("/invitees") && mapa[`${EVENT_URI}/invitees`] !== undefined) {
      return ok(mapa[`${EVENT_URI}/invitees`]);
    }
    if (url.includes("/users/me") && mapa["/users/me"] !== undefined) {
      return ok(mapa["/users/me"]);
    }
    if (url.includes("/scheduled_events") && mapa["/scheduled_events"] !== undefined) {
      return ok(mapa["/scheduled_events"]);
    }
    throw new Error(`URL inesperada: ${url}`);
  }) as unknown as FetchLike;
}

describe("uuidInvitadoDelLink", () => {
  it("saca el uuid de un link de invitee", () => {
    const url = "https://calendly.com/d/abc-def/reunion-retia/invitees/UUID-123";
    expect(uuidInvitadoDelLink(url)).toBe("UUID-123");
  });

  it("acepta www.calendly.com", () => {
    expect(
      uuidInvitadoDelLink("https://www.calendly.com/d/x/y/invitees/ZZ"),
    ).toBe("ZZ");
  });

  it("devuelve null si no es calendly", () => {
    expect(uuidInvitadoDelLink("https://ejemplo.com/d/x/invitees/AA")).toBeNull();
  });

  it("devuelve null si no hay segmento invitees", () => {
    expect(uuidInvitadoDelLink("https://calendly.com/d/x/y")).toBeNull();
  });

  it("devuelve null si invitees no lleva uuid detrás", () => {
    expect(uuidInvitadoDelLink("https://calendly.com/d/x/invitees/")).toBeNull();
  });

  it("devuelve null ante una url basura", () => {
    expect(uuidInvitadoDelLink("no-es-una-url")).toBeNull();
  });
});

describe("citaDeCalendly", () => {
  const base = {
    "/users/me": { resource: { current_organization: ORG } },
    "/scheduled_events": {
      collection: [{ uri: EVENT_URI, start_time: "2026-09-30T15:00:00.000000Z", status: "active" }],
    },
    [`${EVENT_URI}/invitees`]: {
      collection: [
        { uri: "https://api.calendly.com/scheduled_events/EV1/invitees/OTRO" },
        { uri: "https://api.calendly.com/scheduled_events/EV1/invitees/UUID-123" },
      ],
    },
  };

  it("devuelve la cita del evento cuyo invitado tiene el uuid exacto, no cancelada", async () => {
    const fetch = fetchFalso(base);
    const cita = await citaDeCalendly({
      token: "tok",
      correo: "lead@correo.com",
      uuidInvitado: "UUID-123",
      fetch,
    });
    expect(cita).not.toBeNull();
    expect(cita!.inicio).toBeInstanceOf(Date);
    expect(cita!.inicio.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(cita!.cancelada).toBe(false);
  });

  it("marca cancelada cuando el EVENTO está en canceled", async () => {
    const fetch = fetchFalso({
      "/users/me": { resource: { current_organization: ORG } },
      "/scheduled_events": {
        collection: [{ uri: EVENT_URI, start_time: "2026-09-30T15:00:00Z", status: "canceled" }],
      },
      [`${EVENT_URI}/invitees`]: {
        collection: [{ uri: "https://api.calendly.com/scheduled_events/EV1/invitees/UUID-123" }],
      },
    });
    const cita = await citaDeCalendly({ token: "t", correo: "a@b.com", uuidInvitado: "UUID-123", fetch });
    expect(cita?.cancelada).toBe(true);
  });

  it("marca cancelada cuando el INVITADO está en canceled", async () => {
    const fetch = fetchFalso({
      "/users/me": { resource: { current_organization: ORG } },
      "/scheduled_events": {
        collection: [{ uri: EVENT_URI, start_time: "2026-09-30T15:00:00Z", status: "active" }],
      },
      [`${EVENT_URI}/invitees`]: {
        collection: [
          { uri: "https://api.calendly.com/scheduled_events/EV1/invitees/UUID-123", status: "canceled" },
        ],
      },
    });
    const cita = await citaDeCalendly({ token: "t", correo: "a@b.com", uuidInvitado: "UUID-123", fetch });
    expect(cita?.cancelada).toBe(true);
  });

  it("devuelve null si el uuid no aparece, aunque el correo tenga citas", async () => {
    const fetch = fetchFalso(base);
    const cita = await citaDeCalendly({
      token: "tok",
      correo: "lead@correo.com",
      uuidInvitado: "NO-EXISTE",
      fetch,
    });
    expect(cita).toBeNull();
  });

  it("NO empareja por correo solo: otro uuid en la misma cita no cuenta", async () => {
    // El correo devuelve una cita, pero su invitado tiene un uuid distinto.
    const fetch = fetchFalso({
      "/users/me": { resource: { current_organization: ORG } },
      "/scheduled_events": { collection: [{ uri: EVENT_URI, start_time: "2026-09-30T15:00:00Z" }] },
      [`${EVENT_URI}/invitees`]: {
        collection: [{ uri: "https://api.calendly.com/scheduled_events/EV1/invitees/OTRO" }],
      },
    });
    const cita = await citaDeCalendly({
      token: "tok",
      correo: "lead@correo.com",
      uuidInvitado: "UUID-123",
      fetch,
    });
    expect(cita).toBeNull();
  });

  it("un 401 lanza ErrorDeCalendly, no null", async () => {
    const fetch = vi.fn(async () => fallo(401)) as unknown as FetchLike;
    await expect(
      citaDeCalendly({ token: "malo", correo: "a@b.com", uuidInvitado: "X", fetch }),
    ).rejects.toBeInstanceOf(ErrorDeCalendly);
  });

  it("un 500 lanza ErrorDeCalendly", async () => {
    const fetch = vi.fn(async () => fallo(500)) as unknown as FetchLike;
    await expect(
      citaDeCalendly({ token: "tok", correo: "a@b.com", uuidInvitado: "X", fetch }),
    ).rejects.toBeInstanceOf(ErrorDeCalendly);
  });

  it("si no hay organización en /users/me, lanza ErrorDeCalendly", async () => {
    const fetch = fetchFalso({ "/users/me": { resource: {} } });
    await expect(
      citaDeCalendly({ token: "tok", correo: "a@b.com", uuidInvitado: "X", fetch }),
    ).rejects.toBeInstanceOf(ErrorDeCalendly);
  });

  it("una fecha inválida del evento lanza ErrorDeCalendly", async () => {
    const fetch = fetchFalso({
      "/users/me": { resource: { current_organization: ORG } },
      "/scheduled_events": { collection: [{ uri: EVENT_URI, start_time: "no-es-fecha" }] },
      [`${EVENT_URI}/invitees`]: {
        collection: [{ uri: "https://api.calendly.com/scheduled_events/EV1/invitees/UUID-123" }],
      },
    });
    await expect(
      citaDeCalendly({ token: "tok", correo: "a@b.com", uuidInvitado: "UUID-123", fetch }),
    ).rejects.toBeInstanceOf(ErrorDeCalendly);
  });

  it("un error de red (fetch que lanza) sale como ErrorDeCalendly", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as FetchLike;
    await expect(
      citaDeCalendly({ token: "tok", correo: "a@b.com", uuidInvitado: "X", fetch }),
    ).rejects.toBeInstanceOf(ErrorDeCalendly);
  });

  it("acota la búsqueda por correo (invitee_email en la URL)", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/users/me")) return ok({ resource: { current_organization: ORG } });
      if (url.includes("/scheduled_events")) {
        expect(url).toContain("invitee_email=lead%40correo.com");
        expect(url).toContain(`organization=${encodeURIComponent(ORG)}`);
        return ok({ collection: [] });
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as FetchLike;
    const cita = await citaDeCalendly({
      token: "tok",
      correo: "lead@correo.com",
      uuidInvitado: "X",
      fetch,
    });
    expect(cita).toBeNull();
  });
});

describe("citaDeCalendly — paginacion", () => {
  it("sigue next_page: un uuid en la pagina 2 de eventos se encuentra, no sale null", async () => {
    const EV2 = "https://api.calendly.com/scheduled_events/EV2";
    const PAGINA_2 = "https://api.calendly.com/scheduled_events?page_token=P2";
    const fetch: FetchLike = vi.fn(async (url: string) => {
      if (url.endsWith("/users/me")) return ok({ resource: { current_organization: ORG } });
      if (url === PAGINA_2) {
        return ok({ collection: [{ uri: EV2, start_time: "2026-10-01T14:00:00Z" }], pagination: {} });
      }
      if (url.startsWith(`${EVENT_URI}/invitees`)) {
        return ok({ collection: [{ uri: `${EVENT_URI}/invitees/OTRO` }] });
      }
      if (url.startsWith(`${EV2}/invitees`)) {
        return ok({ collection: [{ uri: `${EV2}/invitees/UUID-123` }] });
      }
      if (url.includes("/scheduled_events?")) {
        return ok({
          collection: [{ uri: EVENT_URI, start_time: "2026-09-30T15:00:00Z" }],
          pagination: { next_page: PAGINA_2 },
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    const cita = await citaDeCalendly({ token: "t", correo: "a@b.co", uuidInvitado: "UUID-123", fetch });
    expect(cita?.inicio.toISOString()).toBe("2026-10-01T14:00:00.000Z");
  });
});
