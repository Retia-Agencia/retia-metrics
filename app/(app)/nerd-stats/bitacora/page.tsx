import Link from "next/link";
import { paginaDeAccesoTotal } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { fechaHoraEnBogota, num, truncarId } from "@/lib/format";
import {
  filtroDeLaUrl,
  opcionesDeBitacora,
  paginaDeBitacora,
  TABLA_MOVIMIENTOS,
  USUARIO_SISTEMA,
  type EntradaBitacora,
  type FiltroBitacora,
} from "@/lib/queries/bitacora";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { FiltroFecha } from "@/components/filtros/filtro-fecha";
import { FiltroSelect } from "@/components/filtros/filtro-select";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * `/nerd-stats/bitacora` (ticket 076, ADR 0042 punto 3): toda escritura del CRM, con quien y
 * cuando, filtrable por usuario, tabla y rango. Junta `change_log` y `deal_etapa_historial` en
 * una sola lista sin duplicar el movimiento de etapa (ver `lib/queries/bitacora.ts`).
 *
 * Exclusiva del developer como el resto de Nerd Stats: `paginaDeAccesoTotal` corre ANTES de
 * leer un solo filtro, asi que una peticion forjada con filtros no llega a la consulta.
 * Los filtros viven en la URL (ADR 0023) y se validan con zod; lo invalido se descarta.
 */
export default async function BitacoraPage({ searchParams }: Props) {
  await paginaDeAccesoTotal();

  const filtro = filtroDeLaUrl(await searchParams);
  const [pagina, opciones] = await Promise.all([paginaDeBitacora(filtro, db), opcionesDeBitacora(db)]);
  const enlace = "text-marca-texto underline-offset-4 outline-none hover:underline focus-visible:underline";

  return (
    <PageShell
      titulo="Bitácora"
      descripcion="Toda escritura del CRM: quién, cuándo y qué tocó. Sin valores: guardan datos de leads."
      acciones={
        <Link href="/nerd-stats" className={`text-sm ${enlace}`}>
          Volver a Nerd Stats
        </Link>
      }
    >
      <div className="space-y-4">
        <BarraDeFiltros nombres={["usuario", "tabla", "desde", "hasta"]}>
          <FiltroSelect nombre="usuario" etiqueta="Usuario" opciones={[
            { value: USUARIO_SISTEMA, label: "Sistema (sin usuario)" },
            ...opciones.usuarios.map((u) => ({ value: u.id, label: u.email })),
          ]} />
          <FiltroSelect nombre="tabla" etiqueta="Tabla" todos="Todas" opciones={[
            { value: TABLA_MOVIMIENTOS, label: "Movimientos de etapa" },
            ...opciones.tablas.map((t) => ({ value: t, label: t })),
          ]} />
          <FiltroFecha nombre="desde" etiqueta="Desde" />
          <FiltroFecha nombre="hasta" etiqueta="Hasta" />
        </BarraDeFiltros>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <span className="cifra">{num(pagina.total)}</span> escrituras
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Fechas en Bogotá. Un movimiento de etapa sale una vez, del historial del deal; los demás campos, de la
              bitácora de cambios.
            </p>
          </CardHeader>
          <CardContent>
            {pagina.entradas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay escrituras con estos filtros. Prueba otro rango o quita el filtro de usuario o de tabla.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Cuándo</th>
                      <th className="py-2 pr-4 font-medium">Qué</th>
                      <th className="py-2 pr-4 font-medium">Registro</th>
                      <th className="py-2 pr-4 font-medium">Quién</th>
                      <th className="py-2 font-medium">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y [&_tr]:transition-colors [&_tr]:duration-150 [&_tr:hover]:bg-muted/40">
                    {pagina.entradas.map((e) => (
                      <tr key={`${e.tipo}-${e.id}`}>
                        <td className="cifra whitespace-nowrap py-2 pr-4">{fechaHoraEnBogota(e.cuando)}</td>
                        <td className="py-2 pr-4">
                          <Que entrada={e} />
                        </td>
                        <td className="py-2 pr-4">
                          <Registro entrada={e} enlace={enlace} />
                        </td>
                        <td className="py-2 pr-4">{e.quien ?? <span className="text-muted-foreground">sistema</span>}</td>
                        <td className="py-2">
                          <Badge variant="neutro">{e.tipo === "movimiento" ? "motor" : e.origen}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacion filtro={filtro} paginas={pagina.paginas} enlace={enlace} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Que({ entrada: e }: { entrada: EntradaBitacora }) {
  if (e.tipo === "cambio") {
    return (
      <span>
        <code className="text-xs">{e.tabla}</code> · <code className="text-xs">{e.campo}</code>
      </span>
    );
  }
  const etapa = (v: string | null) => (v === null ? "—" : (NOMBRE_DE_ETAPA[v as keyof typeof NOMBRE_DE_ETAPA] ?? v));
  const pendiente = (v: string | null) =>
    v === null ? "sin pendiente" : (NOMBRE_DE_PENDIENTE[v as keyof typeof NOMBRE_DE_PENDIENTE] ?? v);
  return (
    <span>
      Etapa: {e.de === null ? "nace en" : `${etapa(e.de)} →`} {etapa(e.a)}
      {e.pendienteDe !== e.pendienteA ? (
        <span className="text-muted-foreground">
          {" "}
          · {pendiente(e.pendienteDe)} → {pendiente(e.pendienteA)}
        </span>
      ) : null}
    </span>
  );
}

function Registro({ entrada: e, enlace }: { entrada: EntradaBitacora; enlace: string }) {
  if (e.registroId === null) return <span className="text-muted-foreground">—</span>;
  const corto = <code className="text-xs">{truncarId(e.registroId)}</code>;
  if (!e.programaSlug) return corto;
  return (
    <Link href={`/p/${e.programaSlug}/deals/${e.registroId}`} className={enlace}>
      {corto}
    </Link>
  );
}

function Paginacion({ filtro, paginas, enlace }: { filtro: FiltroBitacora; paginas: number; enlace: string }) {
  if (paginas <= 1) return null;
  const href = (pagina: number) => {
    const q = new URLSearchParams();
    if (filtro.usuario) q.set("usuario", filtro.usuario);
    if (filtro.tabla) q.set("tabla", filtro.tabla);
    if (filtro.desde) q.set("desde", filtro.desde);
    if (filtro.hasta) q.set("hasta", filtro.hasta);
    q.set("pagina", String(pagina));
    return `/nerd-stats/bitacora?${q.toString()}`;
  };
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
      {filtro.pagina > 1 ? (
        <Link href={href(filtro.pagina - 1)} className={enlace}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="cifra text-muted-foreground">
        {num(filtro.pagina)} de {num(paginas)}
      </span>
      {filtro.pagina < paginas ? (
        <Link href={href(filtro.pagina + 1)} className={enlace}>
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
