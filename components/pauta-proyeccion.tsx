import Link from "next/link";
import { Cifra } from "@/components/cifra-con-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ObjetivoDeCohorte } from "@/lib/catalogo/objetivos";
import { fechaCorta, fechaDeInstanteEnBogota, num } from "@/lib/format";
import { cifrasDeProyeccion } from "@/lib/pauta/cifras-de-proyeccion";
import type { ProyeccionDeRoas, ProyeccionGuardada } from "@/lib/queries/proyeccion-roas";

const claseEnlace = "rounded-lg text-marca-texto underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * "¿Qué ROAS esperamos cuando ocurran las citas que faltan?" (ticket 375; como dos Cifras desde el 419, diseño §4.5):
 * el ROAS a hoy, parcial mientras haya citas por venir, y el proyectado con las tasas de cada closer. Un proyectado
 * que no se puede calcular dice "—" y por qué; nunca un número a medias.
 */
export function PautaProyeccion({ proyeccion, historial, hrefPendientes, objetivos, hoy, programa, cohorte }: {
  proyeccion: ProyeccionDeRoas;
  historial: readonly ProyeccionGuardada[];
  /** La lista de las citas pendientes; `null` si no hay ninguna. */
  hrefPendientes: string | null;
  objetivos: readonly ObjetivoDeCohorte[];
  hoy: string;
  programa?: string;
  cohorte?: string;
}) {
  const n = proyeccion.citasPendientes;
  if (n === 0 && historial.length === 0) return null;
  const { aHoy, proyectado } = cifrasDeProyeccion({ proyeccion, historial, objetivos, hoy, programa, cohorte });
  return <Card aria-labelledby="roas-proyectado"><CardHeader>
    <CardTitle id="roas-proyectado">¿Qué ROAS esperamos cuando ocurran las citas que faltan?</CardTitle>
    <p className="text-xs text-muted-foreground">El ROAS de hoy es parcial mientras haya citas pendientes; el proyectado estima cuánto subirá.</p>
  </CardHeader><CardContent className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <Cifra cifra={aHoy} />
      <Cifra cifra={proyectado} />
    </div>
    {n > 0 && hrefPendientes && proyeccion.ultimaCitaEn ? <p className="text-xs text-muted-foreground">
      <Link href={hrefPendientes} className={claseEnlace}>Ver {n === 1 ? "la cita pendiente" : `las ${num(n)} citas pendientes`}</Link>
      {" "}(la última el {fechaCorta(fechaDeInstanteEnBogota(proyeccion.ultimaCitaEn))}).
    </p> : null}
  </CardContent></Card>;
}
