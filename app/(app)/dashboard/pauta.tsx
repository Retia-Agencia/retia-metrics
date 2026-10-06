import Link from "next/link";
import type { ProgramaVisible } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import type { PeriodoResuelto } from "@/lib/periodo";
import { embudoPorCanal, nombresDeCanales } from "@/lib/queries/dashboard";
import { hechosDelEmbudo } from "@/lib/queries/hechos-embudo";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { embudoPorPregunta } from "@/lib/queries/embudo-por-pregunta";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
import { registrosYAgendasPorCanal } from "@/lib/queries/registros-agendas-canal";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { OrigenPorCanal } from "@/components/dashboard/origen-por-canal";
import { EmbudoFormulario } from "@/components/embudo-formulario";
import { EmbudoPorPregunta } from "@/components/embudo-por-pregunta";
import { PautaInterina } from "@/components/pauta-interina";
import { RegistrosAgendasCanal } from "@/components/registros-agendas-canal";
import { Button } from "@/components/ui/button";

/** Pauta contiene tasas y costos: los bloques conservan siempre su programa (ADR 0048). */
export async function PautaPorPrograma({ programas, periodo, hoy }: {
  programas: ProgramaVisible[];
  periodo: PeriodoResuelto;
  hoy: string;
}) {
  const canales = await nombresDeCanales(db);
  return <section id="pauta" className="space-y-6">
    <h2 className="text-xl font-semibold">Pauta y origen (interina)</h2>
    {await Promise.all(programas.map(async (programa) => {
      const [pauta, hechos, formulario, porCanal, porPregunta] = await Promise.all([
        pautaInterina(db, programa.id, periodo.a, {}, hoy),
        hechosDelEmbudo(db, { programId: programa.id, rango: periodo.a }),
        embudoDelFormulario(db, { programId: programa.id, rango: periodo.a }),
        registrosYAgendasPorCanal(db, programa.id, periodo.a, hoy),
        embudoPorPregunta(db, programa.id),
      ]);
      const hrefCon = (filtros: FiltrosPauta) => {
        const q = new URLSearchParams(queryDePeriodo(periodo));
        q.set("seccion", "pauta");
        for (const [clave, valor] of Object.entries(filtros)) if (valor !== undefined) q.set(clave, valor);
        return `/p/${encodeURIComponent(programa.slug)}/dashboard?${q}`;
      };
      return <div key={programa.id} className="space-y-4">
        <h3 className="text-lg font-semibold">
          <Button variant="link" nativeButton={false} render={<Link href={hrefCon({})} />}>{programa.nombre}</Button>
        </h3>
        <PautaInterina vista={pauta} filtros={{}} hrefCon={hrefCon} />
        <OrigenPorCanal filas={embudoPorCanal(hechos, canales)} />
        <RegistrosAgendasCanal vista={porCanal} />
        <EmbudoFormulario embudo={formulario} />
        <EmbudoPorPregunta embudos={porPregunta} />
      </div>;
    }))}
  </section>;
}
