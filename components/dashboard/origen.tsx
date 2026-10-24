import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabla } from "@/components/dashboard/piezas";
import { NOMBRE_DE_AREA } from "@/lib/atribucion/canal";
import { num, pct } from "@/lib/format";
import type { VistaOrigen } from "@/lib/queries/origen";
import type { PeriodoResuelto } from "@/lib/periodo";

function hrefDeEnvios(base: string, periodo: PeriodoResuelto, source?: string | null, medium?: string | null, categoria?: "sin_utm" | "macro") {
  const q = new URLSearchParams({ metrica: "envios", periodo: "custom", a_desde: periodo.a.desde, a_hasta: periodo.a.hasta, sin_b: "1" });
  if (source !== undefined) q.set("source", source ?? "__null__");
  if (medium !== undefined) q.set("medium", medium ?? "__null__");
  if (categoria) q.set("categoria", categoria);
  return `${base}/lista?${q}`;
}

function CifraEnvios({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="cifra underline underline-offset-4" href={href}>{children}</Link>;
}

export function Origen({ vista, base, periodo, soloConteos = false }: { vista: VistaOrigen; base: string; periodo: PeriodoResuelto; soloConteos?: boolean }) {
  const totalPaid = vista.trazaPaid.N3 + vista.trazaPaid.N2 + vista.trazaPaid.N1;
  return <section className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Sin UTM</CardTitle></CardHeader><CardContent>
        <CifraEnvios href={hrefDeEnvios(base, periodo, null, null, "sin_utm")}>{num(vista.sinUtm)}</CifraEnvios>
        {soloConteos ? null : <span className="cifra text-muted-foreground"> · {pct(vista.totalEnvios === 0 ? 0 : vista.sinUtm / vista.totalEnvios)}</span>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Macros sin expandir</CardTitle></CardHeader><CardContent>
        <CifraEnvios href={hrefDeEnvios(base, periodo, undefined, undefined, "macro")}>{num(vista.macros)}</CifraEnvios>
        {soloConteos ? null : <span className="cifra text-muted-foreground"> · {pct(vista.totalEnvios === 0 ? 0 : vista.macros / vista.totalEnvios)}</span>}
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="text-base">Cómo cuenta cada UTM</CardTitle></CardHeader><CardContent>
      <Tabla cabeceras={["UTM source / medium", "Envíos", "Agendas", "Área", "Canal", "Cuenta", "Regla", "Traza"]}>
        {vista.filas.map((fila) => <tr key={`${fila.source ?? "∅"}:${fila.medium ?? "∅"}`}>
          <td className="py-2">{fila.source ?? "—"} / {fila.medium ?? "—"} {fila.nuevo ? <Badge variant="info">Nuevo</Badge> : null}</td>
          <td className="text-right"><CifraEnvios href={hrefDeEnvios(base, periodo, fila.source, fila.medium)}>{num(fila.envios)}</CifraEnvios></td>
          <td className="cifra text-right">{num(fila.agendas)}</td>
          <td>{NOMBRE_DE_AREA[fila.area]}</td><td>{fila.canal}</td><td>{fila.cuenta ?? "—"}</td>
          <td>{fila.regla}</td><td><Badge variant="secondary">{fila.nivel}</Badge></td>
        </tr>)}
      </Tabla>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Traza de envíos Paid</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">
      {(["N3", "N2", "N1"] as const).map((nivel) => <div key={nivel}><p>{nivel}</p><p className="cifra text-lg">{num(vista.trazaPaid[nivel])}{soloConteos ? null : <> · {pct(totalPaid === 0 ? 0 : vista.trazaPaid[nivel] / totalPaid)}</>}</p></div>)}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Plantillas en uso por cuenta</CardTitle></CardHeader><CardContent>
      {vista.plantillas.length === 0 ? <p className="text-sm text-muted-foreground">Sin anuncios activos guardados.</p> : <Tabla cabeceras={["Cuenta", "Vieja", "Pauta", "Otra", "Sin id de anuncio"]}>
        {vista.plantillas.map((fila) => <tr key={fila.cuenta}><td className="py-2">{fila.cuenta}</td><td className="cifra text-right">{num(fila.vieja)}</td><td className="cifra text-right">{num(fila.pauta)}</td><td className="cifra text-right">{num(fila.otra)}</td><td className="cifra text-right">{num(fila.sinId)}</td></tr>)}
      </Tabla>}
    </CardContent></Card>
  </section>;
}
