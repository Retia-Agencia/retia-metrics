import Link from "next/link";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaCorta, fechaDeInstanteEnBogota, num, pct } from "@/lib/format";
import type { ProyeccionDeRoas, ProyeccionGuardada } from "@/lib/queries/proyeccion-roas";

const claseEnlace = "rounded-lg text-marca-texto underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const veces = (n: number) => `${num(n, 2)}×`;

/**
 * Lo que el ROAS todavía no cuenta (ticket 375): las citas por venir de estos envíos, el ROAS proyectado con
 * las tasas de cada closer y, cuando ya pasaron las citas, lo proyectado contra lo real. Un proyectado que no
 * se puede calcular dice "—" y por qué; nunca un número a medias.
 */
export function PautaProyeccion({ proyeccion, historial, hrefPendientes }: {
  proyeccion: ProyeccionDeRoas;
  historial: readonly ProyeccionGuardada[];
  /** La lista de las citas pendientes; `null` si no hay ninguna. */
  hrefPendientes: string | null;
}) {
  const n = proyeccion.citasPendientes;
  if (n === 0 && historial.length === 0) return null;
  const aHoy = proyeccion.roasAHoy.valor;
  return <Card aria-labelledby="roas-proyectado"><CardHeader>
    <CardTitle id="roas-proyectado">Lo que falta por ocurrir</CardTitle>
    {n > 0 && proyeccion.ultimaCitaEn ? <p className="text-sm text-muted-foreground">
      Faltan {hrefPendientes ? <Link href={hrefPendientes} className={claseEnlace}>{num(n)} {n === 1 ? "cita" : "citas"}</Link> : `${num(n)} citas`} de
      estos envíos (la última el {fechaCorta(fechaDeInstanteEnBogota(proyeccion.ultimaCitaEn))}): el ROAS de hoy todavía puede subir.
    </p> : null}
  </CardHeader><CardContent className="space-y-3 text-sm">
    {n > 0 ? <div className="grid gap-3 sm:grid-cols-2">
      <div><div className="text-xs text-muted-foreground">ROAS a hoy</div><div className="cifra text-lg">{aHoy === null ? "—" : veces(aHoy)}</div></div>
      <div><div className="text-xs text-muted-foreground">ROAS proyectado</div>
        <div className="cifra text-lg">{proyeccion.valor === null ? "—" : veces(proyeccion.valor)}</div>
        {proyeccion.valor === null && proyeccion.motivo ? <div className="text-xs text-muted-foreground">{proyeccion.motivo}</div> : null}</div>
    </div> : null}
    {n > 0 && proyeccion.valor !== null ? <ul className="space-y-1 text-xs text-muted-foreground">
      {proyeccion.supuestos.porCloser.map((s) => <li key={s.clave}>
        {s.closer ?? "Sin closer"}: {num(s.citas)} {s.citas === 1 ? "cita" : "citas"} · se presenta {pct(s.pShow!)} y compra {pct(s.pCierre!)}
        {s.usaPrograma ? ` (con la tasa del programa: tiene ${num(s.muestra)} ${s.muestra === 1 ? "persona" : "personas"} con cita y se piden ${num(proyeccion.supuestos.muestraMinima)})` : ` (${num(s.muestra)} personas con cita)`}
      </li>)}
    </ul> : null}
    {historial.length > 0 ? <ul className="space-y-1">
      {historial.map((h) => <li key={h.dia} className="cifra">
        Proyectado el {fechaCorta(h.dia)}: {h.roasProyectado === null ? "—" : veces(h.roasProyectado)} · Real: {h.roasReal === null ? "—" : veces(h.roasReal)}
      </li>)}
    </ul> : null}
    <ComoSeCalcula>
      <p>ROAS proyectado = (lo vendido a hoy + lo que se espera de cada cita pendiente) ÷ gasto.</p>
      <p>Lo esperado de una cita = probabilidad de que se presente × probabilidad de que compre × precio de la cohorte de la persona. Las probabilidades son del closer dueño de la cita, de las últimas {num(proyeccion.supuestos.semanas)} semanas. Si el closer tiene menos de {num(proyeccion.supuestos.muestraMinima)} personas con cita, se usa la tasa del programa.</p>
      <p>Si el gasto del periodo no está completo o no hay historial suficiente, el proyectado es «—» y dice por qué. Cada día se guarda la proyección; cuando las citas ocurren se muestra lo real al lado.</p>
    </ComoSeCalcula>
  </CardContent></Card>;
}
