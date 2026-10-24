import Link from "next/link";
import type { ProgramaVisible } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import type { PeriodoResuelto } from "@/lib/periodo";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { PautaInterina } from "@/components/pauta-interina";
import { Button } from "@/components/ui/button";
import { origenDelPrograma } from "@/lib/queries/origen";
import { Origen } from "@/components/dashboard/origen";

/** Pauta contiene tasas y costos: los bloques conservan siempre su programa (ADR 0048). */
export async function PautaPorPrograma({ programas, periodo, hoy }: {
  programas: ProgramaVisible[];
  periodo: PeriodoResuelto;
  hoy: string;
}) {
  return <section id="pauta" className="space-y-6">
    <h2 className="text-xl font-semibold">Pauta y origen (interina)</h2>
    {await Promise.all(programas.map(async (programa) => {
      const pauta = await pautaInterina(db, programa.id, periodo.a, {}, hoy);
      const hrefCon = (filtros: FiltrosPauta) => {
        const q = new URLSearchParams(queryDePeriodo(periodo));
        q.set("seccion", "pauta");
        for (const [clave, valor] of Object.entries(filtros)) if (valor !== undefined) q.set(clave, valor);
        return `/p/${encodeURIComponent(programa.slug)}/hub?${q}`;
      };
      return <div key={programa.id} className="space-y-4">
        <h3 className="text-lg font-semibold">
          <Button variant="link" nativeButton={false} render={<Link href={hrefCon({})} />}>{programa.nombre}</Button>
        </h3>
        <PautaInterina vista={pauta} filtros={{}} hrefCon={hrefCon} />
      </div>;
    }))}
  </section>;
}

/** En Todos, cada programa conserva su frontera y solo muestra magnitudes contables. */
export async function OrigenPorPrograma({ programas, periodo, hoy, origen }: {
  programas: ProgramaVisible[];
  periodo: PeriodoResuelto;
  hoy: string;
  origen: string;
}) {
  return <section className="space-y-6">{await Promise.all(programas.map(async (programa) => {
    const vista = await origenDelPrograma(db, { programId: programa.id, rango: periodo.a, hoy });
    return <div key={programa.id} className="space-y-4"><h2 className="text-xl font-semibold">{programa.nombre}</h2><Origen vista={vista} slug={programa.slug} periodo={periodo} origen={origen} soloConteos /></div>;
  }))}</section>;
}
