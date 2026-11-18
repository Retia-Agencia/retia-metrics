import { describe, expect, it } from "vitest";
import { cifrasDeMiPrograma, cifrasDeMisTotales } from "@/lib/hub/cifras-de-mi-espacio";
import { explicacionesDeMiEspacio } from "@/lib/hub/explicaciones-de-mi-espacio";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import type { VistaDeMisMetricas, VistaDeMisMetricasTodos } from "@/lib/queries/mi-espacio-metricas";

/** 419 E-5: Mi espacio › Métricas como Cifras, todas del universo «tuyas» (DC-4). */

const detalle = (cantidad: number): DetalleDeCifra => ({
  resumen: { programId: "p", disponible: true, subtotal: { cantidad, caja: [] }, grupos: [] },
  desgloses: { porCloser: [], porEtapa: [], porAntiguedad: [] }, href: "/p/x/hub/lista?metrica=m", fotoDeHoy: false,
});
const periodo = { a: { desde: "2026-11-01", hasta: "2026-11-10" }, b: null, preset: "custom" };
const cifrasA = (pendientes: number, caja: Array<{ moneda: string; total: number }>) => ({
  agendas: 8, shows: 6, noShows: 2, cierres: 3, razonCierre: { valor: 0.5, base: 6, faltan: 0, motivo: undefined },
  pendientesDeResultado: pendientes, madurando: false, caja, comisionUsd: 120,
});
const vista = (pendientes: number, caja: Array<{ moneda: string; total: number }>) => ({
  programa: { id: "p", slug: "p", nombre: "ComunicArte" }, periodo, anteriorDisponible: false, a: cifrasA(pendientes, caja), b: null,
  detalles: { agendas: detalle(8), shows: detalle(6), noShows: detalle(2), cierres: detalle(3), grupoVendidos: detalle(6), grupoPendientes: detalle(pendientes), caja: detalle(1) },
}) as unknown as VistaDeMisMetricas;

describe("419 E-5: Mi espacio como Cifras", () => {
  it("todas las cifras dicen «tuyas» y filtran por Tú", () => {
    const c = cifrasDeMiPrograma({ vista: vista(0, [{ moneda: "USD", total: 500 }]), explicaciones: explicacionesDeMiEspacio(), hoy: "2026-11-13" });
    const todas = [c.citas, c.realizadas, c.noAsistio, c.ventas, c.cierre, ...c.entroACaja, c.comision];
    for (const cifra of todas) {
      expect(cifra.universo).toBe("tuyas");
      expect(cifra.textoDeUniverso).toBe("tuyas");
      expect(cifra.explicacion.filtros).toContainEqual(["Closer", "Tú"]);
    }
    expect(c.citas.textoDelValor).toBe("8");
    expect(c.cierre.valor).toBe(0.5);
    expect(c.comision.textoDelValor).toBe("USD 120,00");
    expect(c.sinResultado).toBeNull();
  });

  it("las citas sin resultado solo salen si hay, con su lista", () => {
    const c = cifrasDeMiPrograma({ vista: vista(2, []), explicaciones: explicacionesDeMiEspacio(), hoy: "2026-11-13" });
    expect(c.sinResultado?.textoDelValor).toBe("2");
    expect(c.sinResultado?.explicacion.evidencia?.href).toBe("/p/x/hub/lista?metrica=m");
  });

  it("Entró a caja es una Cifra por moneda y sin abonos una sola en USD con 0", () => {
    const dos = cifrasDeMiPrograma({ vista: vista(0, [{ moneda: "COP", total: 1000000 }, { moneda: "USD", total: 500 }]), explicaciones: explicacionesDeMiEspacio(), hoy: "2026-11-13" });
    expect(dos.entroACaja.map((x) => x.textoDelValor)).toEqual(["COP 1.000.000", "USD 500,00"]);
    const ninguna = cifrasDeMiPrograma({ vista: vista(0, []), explicaciones: explicacionesDeMiEspacio(), hoy: "2026-11-13" });
    expect(ninguna.entroACaja.map((x) => x.textoDelValor)).toEqual(["USD 0,00"]);
  });

  it("los totales suman conteos y caja por moneda, sin comisión ni tasas", () => {
    const todos = {
      periodo,
      a: { agendas: { valor: 10 }, shows: { valor: 7 }, noShows: { valor: 3 }, cierres: { valor: 4 }, caja: [{ moneda: "USD", valor: 900 }] },
      b: null,
    } as unknown as VistaDeMisMetricasTodos;
    const t = cifrasDeMisTotales({ todos, explicaciones: explicacionesDeMiEspacio(), hoy: "2026-11-13" });
    expect(t.conteos.map((x) => x.textoDelValor)).toEqual(["10", "7", "3", "4"]);
    expect(t.conteos.map((x) => x.concepto)).not.toContain("comision");
    expect(t.entroACaja[0].textoDelValor).toBe("USD 900,00");
    expect(t.conteos[0].explicacion.lectura.map(([n]) => n)).toContain("Suma de programas");
  });
});
