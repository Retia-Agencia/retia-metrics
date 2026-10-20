import { describe, expect, it, vi } from "vitest";
import { eventoEsDelPrograma } from "@/lib/calendly/pertenencia";
import { resolverRoundRobin } from "@/lib/calendly/escritura";
import { ErrorDeApp } from "@/lib/errors";

/**
 * La pertenencia de una cita a un programa (ADR 0098, ticket 289): lo puro de
 * `eventoEsDelPrograma` y el resolvedor `resolverRoundRobin` con un fetch falso, sin red.
 */

const RR = "https://api.calendly.com/event_types/RR";
const PERSONAL = "https://api.calendly.com/event_types/PERSONAL";
const OTRO = "https://api.calendly.com/event_types/OTRO";

describe("eventoEsDelPrograma", () => {
  it("org NO compartida: todo cuenta, incluso un eventType nulo", () => {
    expect(eventoEsDelPrograma({ eventType: OTRO, orgCompartida: false, roundRobin: RR, personales: [PERSONAL] })).toBe(true);
    expect(eventoEsDelPrograma({ eventType: null, orgCompartida: false, roundRobin: null, personales: [] })).toBe(true);
  });

  it("org compartida: solo el round robin o un evento personal", () => {
    expect(eventoEsDelPrograma({ eventType: RR, orgCompartida: true, roundRobin: RR, personales: [PERSONAL] })).toBe(true);
    expect(eventoEsDelPrograma({ eventType: PERSONAL, orgCompartida: true, roundRobin: RR, personales: [PERSONAL] })).toBe(true);
    expect(eventoEsDelPrograma({ eventType: OTRO, orgCompartida: true, roundRobin: RR, personales: [PERSONAL] })).toBe(false);
  });

  it("org compartida: un eventType nulo nunca pertenece", () => {
    expect(eventoEsDelPrograma({ eventType: null, orgCompartida: true, roundRobin: RR, personales: [PERSONAL] })).toBe(false);
  });

  it("org compartida sin round robin: solo los personales", () => {
    expect(eventoEsDelPrograma({ eventType: RR, orgCompartida: true, roundRobin: null, personales: [PERSONAL] })).toBe(false);
    expect(eventoEsDelPrograma({ eventType: PERSONAL, orgCompartida: true, roundRobin: null, personales: [PERSONAL] })).toBe(true);
  });
});

const json = (status: number, cuerpo: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

/** El fetch de resolverRoundRobin: /users/me, miembros, y event_types por miembro. */
function fetchDeEventTypes(porMiembro: { uri: string; schedulingUrl: string }[][]) {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
    .mockResolvedValueOnce(json(200, {
      collection: porMiembro.map((_, i) => ({ user: { uri: `https://api.calendly.com/users/U${i}` } })),
      pagination: {},
    }));
  for (const tipos of porMiembro) {
    fetchImpl.mockResolvedValueOnce(json(200, {
      collection: tipos.map((t) => ({ uri: t.uri, scheduling_url: t.schedulingUrl })),
      pagination: {},
    }));
  }
  return fetchImpl;
}

describe("resolverRoundRobin", () => {
  const URL_RR = "https://calendly.com/retia/round-robin";

  it("con UNA coincidencia devuelve su URI (aunque salga en varios miembros)", async () => {
    const fetchImpl = fetchDeEventTypes([
      [{ uri: RR, schedulingUrl: URL_RR }],
      [{ uri: RR, schedulingUrl: URL_RR }, { uri: OTRO, schedulingUrl: "https://calendly.com/b/otro" }],
    ]);
    await expect(resolverRoundRobin("token", URL_RR, fetchImpl)).resolves.toBe(RR);
  });

  it("con CERO coincidencias es un 422", async () => {
    const fetchImpl = fetchDeEventTypes([[{ uri: OTRO, schedulingUrl: "https://calendly.com/b/otro" }]]);
    const error = await resolverRoundRobin("token", URL_RR, fetchImpl).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 422 });
  });

  it("con DOS coincidencias distintas es un 422", async () => {
    const fetchImpl = fetchDeEventTypes([
      [{ uri: RR, schedulingUrl: URL_RR }],
      [{ uri: "https://api.calendly.com/event_types/RR2", schedulingUrl: URL_RR }],
    ]);
    const error = await resolverRoundRobin("token", URL_RR, fetchImpl).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 422 });
  });
});
