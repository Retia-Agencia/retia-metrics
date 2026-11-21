import { describe, expect, it } from "vitest";
import { capacidadParaMetrica, proyectarListaSegunRol, proyectarParaPauta, type ListaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { METRICAS_DEL_EMBUDO_COMERCIAL, pasosDelEmbudoComercial, type DealParaEmbudoComercial } from "@/lib/queries/embudo-comercial";
import { agruparEmbudoComercialPorPauta, SIN_CAMPANA_IDENTIFICADA } from "@/lib/queries/embudo-comercial-por-pauta";
import type { AtribucionDePauta } from "@/lib/queries/atribucion-de-pauta";
import type { Rol } from "@/lib/auth/roles";

const TODOS_LOS_ROLES = ["gerente", "closer", "developer", "paid_trafficker", "customer_success", "media"] as const;

describe("458: el embudo comercial abre a pauta", () => {
  it("abre las cuatro listas del embudo a quien ve el tablero y deja ventas sin llamada cerrada", () => {
    for (const metrica of METRICAS_DEL_EMBUDO_COMERCIAL) {
      const capacidad = capacidadParaMetrica({ metrica, tieneOrigen: false });
      for (const rol of TODOS_LOS_ROLES) {
        // El tablero lo ven gerente, developer y paid trafficker; el closer y customer success no.
        const veTablero = rol === "gerente" || rol === "developer" || rol === "paid_trafficker";
        expect(capacidad(rol)).toBe(veTablero);
      }
    }
    // «+N sin llamada registrada» son ventas con monto: su lista sigue reservada a quien administra.
    const ventasSinLlamada = capacidadParaMetrica({ metrica: "cierres", tieneOrigen: false });
    expect(ventasSinLlamada("paid_trafficker")).toBe(false);
    expect(ventasSinLlamada("closer")).toBe(false);
    expect(ventasSinLlamada("gerente")).toBe(true);
  });

  it("oculta closer, deal y monto de esas listas para pauta y los conserva para gerente", () => {
    const fila = {
      id: "fila-1", dealId: "deal-1", fecha: "2026-11-06", closer: "Ana", claveCloser: "ana",
      etapa: "Abonado", antiguedad: 1, bucket: "0-2", moneda: "USD", monto: 100, recaudado: 50,
      porCobrar: 50, concepto: null, nota: null, cantidad: 1,
      persona: { nombre: "Persona", leadId: "lead-1" }, ultimaActividad: "2026-11-06",
    };
    const lista: ListaDeMetrica = {
      programId: "programa-1", disponible: true, subtotal: { cantidad: 1, caja: [] },
      dinero: { vendido: 100, recaudado: 50, porCobrar: 50, sobrepago: 0, ventas: 1, lineas: 1, sinSaldoCalculable: 0, sinValorVendido: 0 },
      grupos: [{ closer: fila.closer, claveCloser: fila.claveCloser, etapa: fila.etapa, bucket: fila.bucket, moneda: fila.moneda, monto: fila.monto, cantidad: fila.cantidad }],
      pagina: 1, filas: [{ ...fila }],
    };
    const opciones = { esListaDePauta: false, esListaDeOrigen: false };
    for (const metrica of METRICAS_DEL_EMBUDO_COMERCIAL) {
      // Pauta (paid trafficker) conserva persona y etapa, sin closer, deal ni monto.
      const paraPauta = proyectarListaSegunRol(lista, { rol: "paid_trafficker" as Rol, metrica, ...opciones });
      expect(paraPauta).toEqual(proyectarParaPauta(lista, false));
      expect(paraPauta.filas[0]!.closer).toBeNull();
      expect(paraPauta.filas[0]!.dealId).toBeNull();
      expect(paraPauta.filas[0]!.monto).toBeNull();
      expect(paraPauta.filas[0]!.persona).toEqual({ nombre: "Persona", leadId: "lead-1" });
      // Gerente ve el equipo: conserva closer, deal y monto.
      const paraGerente = proyectarListaSegunRol(lista, { rol: "gerente" as Rol, metrica, ...opciones });
      expect(paraGerente).toEqual(proyectarParaPauta(lista, true));
      expect(paraGerente.filas[0]!.closer).toBe("Ana");
      expect(paraGerente.filas[0]!.dealId).toBe("deal-1");
      expect(paraGerente.filas[0]!.monto).toBe(100);
    }
  });
});

const dealDePauta = (
  dealId: string, campanaId: string | null, anuncioId: string | null,
  estado: Pick<DealParaEmbudoComercial, "agendo" | "tuvoShow" | "compro">,
): { deal: DealParaEmbudoComercial; atribucion?: AtribucionDePauta } => {
  const deal: DealParaEmbudoComercial = { dealId, origen: "completo", area: "paid", ...estado };
  if (campanaId === null) return { deal };
  const atribucion: AtribucionDePauta = {
    envioId: `envio-${dealId}`, leadId: `lead-${dealId}`, nombre: null, fechaEnvio: new Date("2026-10-01T10:00:00-05:00"),
    diaEnvio: "2026-10-01", cuentaComoRegistro: true, canal: "Paid", canalClave: "paid",
    campanaId, campanaNombre: `Campaña ${campanaId}`, cuentaId: "cuenta-1",
    conjuntoId: `conjunto-${campanaId}`, conjuntoNombre: `Conjunto ${campanaId}`,
    anuncioId, anuncioNombre: anuncioId ? `Anuncio ${anuncioId}` : null,
  };
  return { deal, atribucion };
};

describe("458: la tabla por campaña y anuncio del embudo comercial", () => {
  const entradas = [
    dealDePauta("1", "camp-a", "ad-1", { agendo: true, tuvoShow: true, compro: true }),
    dealDePauta("2", "camp-a", "ad-1", { agendo: true, tuvoShow: true, compro: false }),
    dealDePauta("3", "camp-a", "ad-2", { agendo: true, tuvoShow: false, compro: false }),
    dealDePauta("4", "camp-b", "ad-3", { agendo: true, tuvoShow: true, compro: true }),
    dealDePauta("5", null, null, { agendo: false, tuvoShow: false, compro: false }),
  ];
  const deals = entradas.map((e) => e.deal);
  const atribucion = new Map(entradas.flatMap((e) => e.atribucion ? [[e.deal.dealId, e.atribucion] as const] : []));

  it("agrupa por campaña, suma el total y cada grupo es anidado", () => {
    const grupos = agruparEmbudoComercialPorPauta(deals, atribucion, "campana");
    const totalCreados = pasosDelEmbudoComercial(deals).find((p) => p.paso === "creados")!.cantidad;
    const sumaDeGrupos = grupos.reduce((suma, g) => suma + g.pasos.find((p) => p.paso === "creados")!.cantidad, 0);
    expect(sumaDeGrupos).toBe(totalCreados);
    // Una fila para los deals sin atribución, al final.
    expect(grupos.at(-1)!.nombre).toBe(SIN_CAMPANA_IDENTIFICADA);
    expect(grupos.at(-1)!.idMeta).toBeNull();
    // Cada paso de cada grupo es subconjunto del anterior (universo anidado).
    for (const grupo of grupos) {
      for (const [indice, paso] of grupo.pasos.entries()) {
        expect(paso.cantidad).toBe(paso.dealIds.length);
        if (indice > 0) {
          const anteriores = new Set(grupo.pasos[indice - 1]!.dealIds);
          expect(paso.dealIds.every((id) => anteriores.has(id))).toBe(true);
        }
      }
    }
  });

  it("el conteo del corte de una campaña es el de su grupo en la tabla", () => {
    const grupos = agruparEmbudoComercialPorPauta(deals, atribucion, "campana");
    const grupoDeA = grupos.find((g) => g.idMeta === "camp-a")!;
    // La lista filtrada por corte=camp-a toma del universo los deals atribuidos a esa campaña (misma
    // aritmética), así que su conteo por paso coincide con el del grupo de la tabla.
    const idsDelCorte = new Set([...atribucion].filter(([, a]) => a.campanaId === "camp-a").map(([id]) => id));
    const delCorte = deals.filter((d) => idsDelCorte.has(d.dealId));
    const pasosDelCorte = pasosDelEmbudoComercial(delCorte);
    expect(grupoDeA.pasos.map((p) => [p.paso, p.cantidad]))
      .toEqual(pasosDelCorte.map((p) => [p.paso, p.cantidad]));
    expect(grupoDeA.pasos.map((p) => p.cantidad)).toEqual([3, 3, 2, 1]);
  });

  it("agrupa por anuncio con las mismas filas", () => {
    const grupos = agruparEmbudoComercialPorPauta(deals, atribucion, "anuncio");
    const ids = grupos.map((g) => g.idMeta);
    expect(ids).toContain("ad-1");
    expect(ids).toContain("ad-2");
    expect(ids).toContain("ad-3");
    expect(ids.at(-1)).toBeNull();
    const ad1 = grupos.find((g) => g.idMeta === "ad-1")!;
    expect(ad1.pasos.map((p) => p.cantidad)).toEqual([2, 2, 2, 1]);
  });
});
