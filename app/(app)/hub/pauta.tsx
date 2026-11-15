import { Enlace } from "@/components/enlace";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { DatosDelHub } from "@/lib/queries/hub-todos";
import type { NivelPauta, PasoPauta } from "@/lib/queries/roas-de-pauta";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { PautaRoas, type VerPorPauta } from "@/components/pauta-roas";
import { Button } from "@/components/ui/button";
import { Origen } from "@/components/dashboard/origen";
import { UNIVERSO_PAUTA } from "@/lib/vocabulario-metricas";

/** Pauta contiene tasas y costos: en "todos" cada programa muestra solo conteos (ADR 0048). */
export function PautaPorPrograma({ filas, periodo, busqueda }: {
  filas: DatosDelHub["pauta"];
  periodo: PeriodoResuelto;
  busqueda: Record<string, string | string[] | undefined>;
}) {
  const verPor: VerPorPauta = busqueda.ver_por === "canal" ? "canal" : "campana";
  return <section id="pauta" className="space-y-6">
    <div><h2 className="text-xl font-semibold">Pauta y origen</h2><p className="text-xs text-muted-foreground">{UNIVERSO_PAUTA}</p></div>
    {filas.map(({ programa, roas }) => {
      const query = queryDePeriodo(periodo);
      const base = `/p/${encodeURIComponent(programa.slug)}/hub`;
      const hrefVerPor = (v: VerPorPauta) => {
        const q = new URLSearchParams(query);
        q.set("seccion", "pauta");
        if (v !== "campana") q.set("ver_por", v);
        return `${base}?${q}`;
      };
      const origenQuery = new URLSearchParams(query);
      origenQuery.set("seccion", "pauta");
      const origen = `${base}?${origenQuery}`;
      const enlace = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => urlDeLista({
        slug: programa.slug, metrica: "pauta_meta", periodo: { ...periodo, b: null }, origen, pauta: { nivel, id, paso },
      });
      return <div key={programa.id} className="space-y-4">
        <h3 className="text-lg font-semibold">
          <Button variant="link" nativeButton={false} render={<Enlace precarga="al-pasar" href={hrefVerPor("campana")} />}>{programa.nombre}</Button>
        </h3>
        <PautaRoas vista={roas} enlace={enlace} hrefCsv="" verPor={verPor} hrefVerPor={hrefVerPor} soloConteos />
      </div>;
    })}
  </section>;
}

/** En Todos, cada programa conserva su frontera y solo muestra magnitudes contables. */
export function OrigenPorPrograma({ filas, periodo, origen }: {
  filas: DatosDelHub["origenes"];
  periodo: PeriodoResuelto;
  origen: string;
}) {
  return <section className="space-y-6">{filas.map(({ programa, vista }) => {
    return <div key={programa.id} className="space-y-4"><h2 className="text-xl font-semibold">{programa.nombre}</h2><Origen vista={vista} slug={programa.slug} periodo={periodo} origen={origen} soloConteos /></div>;
  })}</section>;
}
