import { describe, expect, it } from "vitest";
import {
  proyectarListaSegunRol,
  proyectarParaPauta,
  proyectarParaTablero,
  type ListaDeMetrica,
} from "@/lib/queries/metricas-con-filas";
import { proyectarDashboardSegunRol, sinListas } from "@/lib/queries/vista-metrica";
import type { Rol } from "@/lib/auth/roles";

const fila = {
  id: "fila-1", dealId: "deal-1", fecha: "2026-11-06", closer: "Ana",
  claveCloser: "ana", etapa: "Abonado", antiguedad: 1, bucket: "0-2",
  moneda: "USD", monto: 100, recaudado: 50, porCobrar: 50, concepto: null,
  nota: null, cantidad: 1, persona: { nombre: "Persona", leadId: "lead-1" },
  ultimaActividad: "2026-11-06",
};
const lista: ListaDeMetrica = {
  programId: "programa-1", disponible: true,
  subtotal: { cantidad: 1, caja: [] },
  dinero: { vendido: 100, recaudado: 50, porCobrar: 50, sobrepago: 0, ventas: 1, sinSaldoCalculable: 0, sinValorVendido: 0 },
  grupos: [{
    closer: fila.closer, claveCloser: fila.claveCloser, etapa: fila.etapa,
    bucket: fila.bucket, moneda: fila.moneda, monto: fila.monto, cantidad: fila.cantidad,
  }],
  pagina: 1, filas: [{ ...fila }],
};

describe("proyeccion compartida segun rol", () => {
  it("conserva exactamente la decision anterior para pauta, no agendaron y una metrica normal", () => {
    const casos: Array<[Rol, string, boolean, boolean, boolean]> = [
      ["gerente", "pauta_meta", true, false, true],
      ["closer", "pauta_meta", true, false, true],
      ["paid_trafficker", "pauta_meta", true, false, false],
      ["gerente", "no_agendaron", false, false, true],
      ["closer", "no_agendaron", false, false, true],
      ["paid_trafficker", "no_agendaron", false, false, false],
      ["gerente", "ventas", false, false, true],
      ["closer", "ventas", false, false, false],
      ["paid_trafficker", "ventas", false, false, false],
    ];
    for (const [rol, metrica, esListaDePauta, esListaDeOrigen, conserva] of casos) {
      const esperado = esListaDePauta || esListaDeOrigen
        ? proyectarParaPauta(lista, conserva)
        : proyectarParaTablero(lista, conserva);
      expect(proyectarListaSegunRol(lista, {
        rol, metrica, esListaDePauta, esListaDeOrigen,
      })).toEqual(esperado);
    }
  });

  it("el dashboard pasa completo a gerente y quita listas a pauta", () => {
    const valor = {
      cifra: {
        resumen: { disponible: true, grupos: [{ closer: "Ana" }] },
        desgloses: { porCloser: [1], porEtapa: [2], porAntiguedad: [3] },
        href: "/lista",
      },
    };
    expect(proyectarDashboardSegunRol(valor, "gerente")).toBe(valor);
    expect(proyectarDashboardSegunRol(valor, "paid_trafficker")).toEqual(sinListas(valor));
  });
});
