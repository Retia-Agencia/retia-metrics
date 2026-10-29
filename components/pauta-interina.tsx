import Link from "next/link";
import type { ReactNode } from "react";
import { ComoSeCalcula } from "@/components/como-se-calcula";
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

/** Los filtros que entiende la lista detras de una cifra (`hub/lista`); null es "ese campo vino vacio". */
export interface FiltrosDeLista {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  categoria?: "con_utm" | "sin_utm" | "macro";
  resultado?: "show" | "no_show";
  /** Solo la lista de ventas (`escalera`): "ventas", "pago_en_llamada", "despues" o "pago_sin_llamada". */
  escalon?: "ventas" | "pago_en_llamada" | "despues" | "pago_sin_llamada";
  pago?: "completo" | "parcial";
}

/** Devuelve el enlace a la lista, o null si quien mira no puede abrirla (las ventas son de Gerencia y developer). */
export type EnlaceDeLista = (metrica: "registros" | "agendas_creadas" | "escalera", filtros: FiltrosDeLista) => string | null;

interface Grupo {
  clave: string;
  /** Lo que se escribe en la primera columna. */
  etiqueta: ReactNode;
  /** A donde lleva profundizar, o nada si es el ultimo nivel o una categoria sin UTM. */
  href: string | null;
  /** Lo que filtra la lista de este renglon, o nada si no hay una lista que cuadre con la cifra. */
  filtrosLista: FiltrosDeLista | null;
  registros: number;
  agendas: number;
  shows: number;
  noShows: number;
  ventas: VentasDeGrupo;
}

interface VentasDeGrupo {
  total: number;
  enLlamada: number;
  despues: number;
  sinLlamada: number;
  completas: number;
  parciales: number;
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
    let filtrosLista: FiltrosDeLista | null = null;
    if (f.categoria !== "con_utm") {
      clave = f.categoria;
      if (f.categoria !== "sin_envio_origen") filtrosLista = { categoria: f.categoria };
      etiqueta = <Badge variant={f.categoria === "macro" ? "alerta" : "neutro"}>{ETIQUETA[f.categoria]}</Badge>;
    } else if (nivel === 1) {
      clave = JSON.stringify([f.source, f.medium]);
      etiqueta = `${valor(f.source)} / ${valor(f.medium)}`;
      filtrosLista = { source: f.source, medium: f.medium, categoria: "con_utm" };
      if (f.source !== null && f.medium !== null) href = hrefCon({ source: f.source, medium: f.medium });
    } else if (nivel === 2) {
      clave = JSON.stringify([f.campaign]);
      etiqueta = valor(f.campaign);
      filtrosLista = { ...filtrosDeUrl(filtros), campaign: f.campaign, categoria: "con_utm" };
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
    const g = grupos.get(clave) ?? { clave, etiqueta, href, filtrosLista, registros: 0, agendas: 0, shows: 0, noShows: 0, ventas: { total: 0, enLlamada: 0, despues: 0, sinLlamada: 0, completas: 0, parciales: 0 } };
    g.registros += f.registros;
    g.agendas += f.agendas;
    g.shows += f.shows;
    g.noShows += f.noShows;
    g.ventas.total += f.ventas;
    g.ventas.enLlamada += f.ventasEnLlamada;
    g.ventas.despues += f.ventasDespues;
    g.ventas.sinLlamada += f.ventasSinLlamada;
    g.ventas.completas += f.ventasCompletas;
    g.ventas.parciales += f.ventasParciales;
    grupos.set(clave, g);
  }
  // Los orígenes con UTM primero, por registros; al final lo que no tiene origen legible, Sin UTM de último.
  const rango = (g: Grupo) => ORDEN_ESPECIAL.indexOf(g.clave as (typeof ORDEN_ESPECIAL)[number]);
  return [...grupos.values()].sort((a, b) =>
    rango(a) - rango(b) || b.registros - a.registros || b.agendas - a.agendas);
}

/** Las filas sin origen legible, en el orden en que van al final de la tabla (-1 = con UTM, arriba). */
const ORDEN_ESPECIAL = ["macro", "sin_envio_origen", "sin_utm"] as const;

function filtrosDeUrl(f: FiltrosPauta): FiltrosDeLista {
  return {
    ...(f.source !== undefined ? { source: f.source } : {}),
    ...(f.medium !== undefined ? { medium: f.medium } : {}),
  };
}

const claseEnlace =
  "rounded-lg text-marca-texto underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** La cifra es un enlace a las personas que cuenta, o solo texto si no hay lista que cuadre. */
function Cifra({ valor: n, href }: { valor: number; href: string | null }) {
  if (href === null || n === 0) return <>{num(n)}</>;
  return (
    <Link href={href} className={claseEnlace} title="Ver las personas">
      {num(n)}
    </Link>
  );
}

/** La tasa de no show sobre shows + no shows; las dos cifras ya están en sus columnas. */
function TasaNoShow({ noShows, shows }: { noShows: number; shows: number }) {
  const resueltas = noShows + shows;
  if (resueltas === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="block"><span className="block font-medium">{pct(noShows / resueltas)}</span>
    <span className="block text-xs text-muted-foreground">{num(noShows)} de {num(resueltas)} con resultado</span></span>;
}

/** La venta, con cuando pagaron y cuanto: la linea de "en llamada / despues" y la de "completas / parciales". */
function VentasDelRenglon({ ventas, de, filtros }: {
  ventas: VentasDeGrupo;
  de: (metrica: "escalera", f: FiltrosDeLista | null) => string | null;
  filtros: FiltrosDeLista | null;
}) {
  if (ventas.total === 0) return <span className="text-muted-foreground">0 ventas</span>;
  const con = (extra: Partial<FiltrosDeLista>) => (filtros ? de("escalera", { ...filtros, ...extra }) : null);
  const partes = (items: Array<[number, string, string | null]>) =>
    items.filter(([n]) => n > 0).map(([n, texto, href], i) => (
      <span key={texto}>
        {i > 0 ? " · " : ""}
        {href ? <Link href={href} className={claseEnlace}>{num(n)} {texto}</Link> : `${num(n)} ${texto}`}
      </span>
    ));
  const v = ventas;
  return (
    <span className="block">
      <span className="block font-medium">
        <Cifra valor={v.total} href={con({ escalon: "ventas" })} /> {v.total === 1 ? "venta" : "ventas"}
      </span>
      <span className="block text-xs text-muted-foreground">
        <span>Cuándo: </span>
        {partes([
          [v.enLlamada, "en llamada", con({ escalon: "pago_en_llamada" })],
          [v.despues, "después", con({ escalon: "despues" })],
          [v.sinLlamada, "sin llamada", con({ escalon: "pago_sin_llamada" })],
        ])}
      </span>
      <span className="block text-xs text-muted-foreground">
        <span>Pago: </span>
        {partes([
          [v.completas, v.completas === 1 ? "completa" : "completas", con({ escalon: "ventas", pago: "completo" })],
          [v.parciales, v.parciales === 1 ? "parcial" : "parciales", con({ escalon: "ventas", pago: "parcial" })],
        ])}
      </span>
    </span>
  );
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
  enlaceLista,
}: {
  vista: VistaPautaInterina;
  filtros: FiltrosPauta;
  /** El link a esta misma pagina con estos filtros de UTM, conservando el rango. */
  hrefCon: (f: FiltrosPauta) => string;
  /** El link a la lista de personas detras de una cifra. Sin el, las cifras son solo texto. */
  enlaceLista?: EnlaceDeLista;
}) {
  const { resumen, sinUtmHoy } = vista;
  const grupos = agrupar(vista.filas, filtros, hrefCon);
  const filtrando = filtros.source !== undefined || filtros.medium !== undefined || filtros.campaign !== undefined;
  const de = (metrica: "registros" | "agendas_creadas" | "escalera", f: FiltrosDeLista | null) =>
    enlaceLista && f ? enlaceLista(metrica, f) : null;
  // Los totales de arriba son los del periodo SIN los filtros de UTM (`pautaInterina`): sus listas tambien.
  const resueltasTotal = resumen.shows + resumen.noShows;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1"><CardTitle className="text-base">De dónde llegan los registros y las agendas</CardTitle>
            <p className="text-xs text-muted-foreground">Cada fila es un origen. Toca un nombre para profundizar o una cifra para ver sus personas.</p>
          </div>
          <ComoSeCalcula>
            <section className="space-y-1"><h3 className="font-medium">De dónde sale</h3><p className="text-muted-foreground">
              Los registros vienen de los formularios con sus UTM. Agendas son citas creadas en el periodo, con el origen
              del formulario que abrió su deal. Shows y no shows son el resultado que marca el closer. Ventas son deals
              que pasaron a Ganado en el periodo.
            </p></section>
            <section className="space-y-1"><h3 className="font-medium">Fórmulas</h3><p className="text-muted-foreground">
              % no show = no shows ÷ (shows + no shows). Pendientes y canceladas no entran.
            </p></section>
            <section className="space-y-1"><h3 className="font-medium">Qué la deja incompleta</h3><p className="text-muted-foreground">
              <span className="cifra">{num(resumen.sinUtm)}</span> registros sin UTM. <span className="cifra">{num(resumen.citasSinMarcar)}</span> citas pasadas sin marcar.
            </p></section>
          </ComoSeCalcula>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Kpi titulo="Registros" valor={<Cifra valor={resumen.registros} href={de("registros", {})} />} />
          <Kpi
            titulo="Agendas"
            valor={<Cifra valor={resumen.agendas} href={de("agendas_creadas", {})} />}
            nota={`${num(resumen.agendasSinEnvioDeOrigen)} sin formulario de origen`}
          />
          <Kpi
            titulo="Shows"
            valor={<Cifra valor={resumen.shows} href={de("agendas_creadas", { resultado: "show" })} />}
            nota={resumen.citasSinMarcar > 0 ? `${num(resumen.citasSinMarcar)} citas pasadas sin marcar` : "la cita ocurrió"}
          />
          <Kpi
            titulo="No shows"
            valor={<Cifra valor={resumen.noShows} href={de("agendas_creadas", { resultado: "no_show" })} />}
            nota={resueltasTotal === 0 ? "—" : `${pct(resumen.noShows / resueltasTotal)} de ${num(resueltasTotal)} citas resueltas`}
          />
          <Kpi
            titulo="Ventas"
            valor={<Cifra valor={resumen.ventas} href={de("escalera", { escalon: "ventas" })} />}
            nota="cerradas en el periodo"
          />
          <Kpi
            titulo="Sin UTM"
            valor={<Cifra valor={resumen.sinUtm} href={de("registros", { categoria: "sin_utm" })} />}
            nota={
              resumen.registros === 0
                ? "—"
                : `${pct(resumen.sinUtm / resumen.registros)} de los registros${resumen.macro > 0 ? ` · ${num(resumen.macro)} con macro sin expandir` : ""}`
            }
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
                <th className="py-2 pl-3 text-right font-medium">Registros</th>
                <th className="py-2 pl-3 text-right font-medium">Agendas</th>
                <th className="py-2 pl-3 text-right font-medium">Shows</th>
                <th className="py-2 pl-3 text-right font-medium">No shows</th>
                <th className="py-2 pl-3 text-right font-medium" title="No shows sobre shows + no shows. Las agendas pendientes o canceladas no entran">% no show<span className="block text-xs font-normal">de llamadas con resultado</span></th>
                <th className="py-2 pl-3 text-right font-medium" title="Ventas cerradas en el periodo con el origen de esta fila, cuándo pagaron y si fue completo o parcial">Ventas</th>
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
                  <td className="cifra py-2 pl-3 text-right">
                    <Cifra valor={g.registros} href={de("registros", g.filtrosLista)} />
                  </td>
                  <td className="cifra py-2 pl-3 text-right">
                    <Cifra valor={g.agendas} href={de("agendas_creadas", g.filtrosLista)} />
                  </td>
                  <td className="cifra py-2 pl-3 text-right">
                    <Cifra valor={g.shows} href={de("agendas_creadas", g.filtrosLista && { ...g.filtrosLista, resultado: "show" })} />
                  </td>
                  <td className="cifra py-2 pl-3 text-right">
                    <Cifra valor={g.noShows} href={de("agendas_creadas", g.filtrosLista && { ...g.filtrosLista, resultado: "no_show" })} />
                  </td>
                  <td className="cifra py-2 pl-3 text-right">
                    <TasaNoShow noShows={g.noShows} shows={g.shows} />
                  </td>
                  <td className="cifra py-2 pl-3 text-right">
                    <VentasDelRenglon ventas={g.ventas} de={de} filtros={g.filtrosLista} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
