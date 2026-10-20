import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { payloadDeVenta } from "@/lib/meta-capi/payload";

const h = (valor: string) => createHash("sha256").update(valor).digest("hex");

describe("payload de venta para Meta CAPI", () => {
  it("normaliza y cifra cada identificador, conserva fbc sin cifrar y no filtra PII", () => {
    const eventTime = new Date("2026-10-20T15:30:00.123Z");
    const capturadoEn = new Date("2026-10-18T09:10:11.456Z");
    const payload = payloadDeVenta({
      deal: { id: "deal-opaco", valorVendidoUsd: "797.00" },
      lead: {
        id: "lead-opaco", emailNormalizado: " PRUEBA@RETIA.CO ", telefono: "+57 (315) 555-1212",
        nombre: "  Ana María Pérez ", pais: "México",
      },
      fbc: { fbclid: "clic-opaco", capturadoEn },
      eventTime,
    });

    expect(payload).toMatchObject({
      event_name: "Purchase", event_id: "deal-opaco", event_time: Math.floor(eventTime.getTime() / 1000),
      action_source: "system_generated", custom_data: { value: 797, currency: "USD" },
      user_data: {
        em: [h("prueba@retia.co")], ph: [h("573155551212")], fn: [h("ana")],
        ln: [h("maría pérez")], country: [h("mx")], external_id: [h("lead-opaco")],
        fbc: `fb.1.${capturadoEn.getTime()}.clic-opaco`,
      },
    });
    const serializado = JSON.stringify(payload);
    for (const pii of ["prueba@retia.co", "3155551212", "Ana", "María", "México"]) {
      expect(serializado.toLowerCase()).not.toContain(pii.toLowerCase());
    }
  });

  it("omite teléfono, apellido, país y fbc cuando no hay datos válidos", () => {
    const payload = payloadDeVenta({
      deal: { id: "d", valorVendidoUsd: "1" },
      lead: { id: "l", emailNormalizado: "a@b.co", telefono: "---", nombre: "Luz", pais: "Latam" },
      fbc: null, eventTime: new Date(0),
    });
    expect(payload.user_data).toEqual({ em: [h("a@b.co")], fn: [h("luz")], external_id: [h("l")] });
  });
});
