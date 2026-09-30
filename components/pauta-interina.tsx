import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota, num, pct, truncarId } from "@/lib/format";
import type { CategoriaOrigen, FilaPauta, FiltrosPauta, VistaPautaInterina } from "@/lib/queries/pauta-interina";

/**
 * La vista interina de Pauta (ticket 093). Pinta lo que calculo `pautaInterina`; no calcula
 * metricas. Se profundiza por la URL en tres niveles: canal (source / medium), campaña, y
 * `utm_content` / `utm_term` crudos. Cada nivel es un filtro de la URL, asi que se comparte
 * con un link y el boton "atras" funciona.
 */

const ETIQUETA: Record<Exclude<CategoriaOrigen, "con_utm">, string> = {
  sin_utm: "Sin UTM",
  macro: "Macro sin expandir",
  sin_envio_origen: "Sin envío de origen",
};

interface Grupo {
  clave: string;
  /** Lo que se escribe en la primera columna. */
  etiqueta: ReactNode;
  /** A donde lleva profundizar, o nada si es el ultimo nivel o una categoria sin UTM. */
  href: string | null;
  registros: number;
  agendas: number;
}

function valor(v: string | null): string {
  return v ?? "—";
}

/** Agrupa la serie en el nivel que piden los filtros. Sin UTM, macro y sin origen van aparte. */
function agrupar(filas: FilaPauta[], filtros: FiltrosPauta, hrefCon: (f: FiltrosPauta) => string): Grupo[] {
  const nivel = filtros.campaign !== undefined ? 3 : filtros.source !== undefined || filtros.medium !== undefined ? 2 : 1;
  const grupos = new Map<string, Grupo>();
  for (const f of filas) {
    let clave: string;
    let etiqueta: ReactNode;
    let href: string | null = null;
    if (f.categoria !== "con_utm") {
      clave = f.categoria;
      etiqueta = <Badge variant={f.categoria === "macro" ? "alerta" : "neutro"}>{ETIQUETA[f.categoria]}</Badge>;
    } else if (nivel === 1) {
      clave = JSON.stringify([f.source, f.medium]);
      etiqueta = `${valor(f.source)} / ${valor(f.medium)}`;
      if (f.source !== null && f.medium !== null) href = hrefCon({ source: f.source, medium: f.medium });
    } else if (nivel === 2) {
      clave = JSON.stringify([f.campaign]);
      etiqueta = valor(f.campaign);
      if (f.campaign !== null) href = hrefCon({ ...filtros, campaign: f.campaign });
    } else {
      clave = JSON.stringify([f.content, f.term]);
      etiqueta = (
        <span className="space-y-0.5">
          <span className="block">utm_content: {valor(f.content)}</span>
          <span className="block text-muted-foreground">utm_term: {valor(f.term)}</span>
        </span>
      );
    }
    const g = grupos.get(clave) ?? { clave, etiqueta, href, registros: 0, agendas: 0 };
    g.registros += f.registros;
    g.agendas += f.agendas;
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => b.registros - a.registros || b.agendas - a.agendas);
}

function Kpi({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="cifra text-lg font-semibold">{valor}</p>
      {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

export function PautaInterina({
  vista,
  filtros,
  hrefCon,
}: {
  vista: VistaPautaInterina;
  filtros: FiltrosPauta;
  /** El link a esta misma pagina con estos filtros de UTM, conservando el rango. */
  hrefCon: (f: FiltrosPauta) => string;
}) {
  const { resumen, sinUtmHoy } = vista;
  const grupos = agrupar(vista.filas, filtros, hrefCon);
  const filtrando = filtros.source !== undefined || filtros.medium !== undefined || filtros.campaign !== undefined;
  const totalRegistros = grupos.reduce((s, g) => s + g.registros, 0);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Origen de registros y agendas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Vista interina de Pauta. Un registro es un envío completo; una agenda, una llamada creada en el rango,
          con el origen del envío que abrió su deal. No aplica el filtro de closer.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi titulo="Registros" valor={num(resumen.registros)} />
          <Kpi
            titulo="Sin UTM"
            valor={num(resumen.sinUtm)}
            nota={resumen.registros === 0 ? "—" : `${pct(resumen.sinUtm / resumen.registros)} de los registros`}
          />
          <Kpi titulo="Macro sin expandir" valor={num(resumen.macro)} nota="se cuentan aparte, no son datos" />
          <Kpi
            titulo="Agendas"
            valor={num(resumen.agendas)}
            nota={`${num(resumen.agendasSinEnvioDeOrigen)} sin envío de origen`}
          />
        </div>

        <details className="rounded-lg bg-muted/40 px-3 py-2">
          <summary className="cursor-pointer rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Hoy llegaron <span className="cifra font-semibold">{num(sinUtmHoy.length)}</span> registros sin UTM
          </summary>
          {sinUtmHoy.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Ninguno por ahora.</p>
          ) : (
            <ul className="mt-2 divide-y">
              {sinUtmHoy.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate">{e.nombre ?? "Sin nombre"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <span className="cifra">{fechaHoraEnBogota(e.fechaEnvio)}</span> · {truncarId(e.id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>

        {filtrando ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filtrando:</span>
            {filtros.source !== undefined || filtros.medium !== undefined ? (
              <Badge variant="info">
                {valor(filtros.source ?? null)} / {valor(filtros.medium ?? null)}
              </Badge>
            ) : null}
            {filtros.campaign !== undefined ? <Badge variant="info">{filtros.campaign}</Badge> : null}
            <Link
              href={hrefCon({})}
              className="rounded-lg text-marca-texto underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Quitar filtros
            </Link>
          </div>
        ) : null}

        {grupos.length === 0 ? (
          <p className="text-muted-foreground">
            No hay registros ni agendas en este rango{filtrando ? " con estos filtros" : ""}.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">
                  {filtros.campaign !== undefined ? "Contenido" : filtrando ? "Campaña" : "Canal (source / medium)"}
                </th>
                <th className="py-2 text-right font-medium">Registros</th>
                <th className="py-2 text-right font-medium">%</th>
                <th className="py-2 text-right font-medium">Agendas</th>
              </tr>
            </thead>
            <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
              {grupos.map((g) => (
                <tr key={g.clave}>
                  <td className="py-2 pr-3 break-all">
                    {g.href ? (
                      <Link
                        href={g.href}
                        className="rounded-lg text-marca-texto underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {g.etiqueta}
                      </Link>
                    ) : (
                      g.etiqueta
                    )}
                  </td>
                  <td className="cifra py-2 text-right">{num(g.registros)}</td>
                  <td className="cifra py-2 text-right text-muted-foreground">
                    {totalRegistros === 0 ? "—" : pct(g.registros / totalRegistros)}
                  </td>
                  <td className="cifra py-2 text-right">{num(g.agendas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
