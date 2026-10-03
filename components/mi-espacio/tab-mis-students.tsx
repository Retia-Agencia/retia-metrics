import Link from "next/link";
import { db } from "@/lib/db";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { studentsDelPrograma } from "@/lib/queries/estudiantes";
import { fecha, fechaDeInstanteEnBogota, saldoLegible } from "@/lib/format";
import { enlaceConVuelta, origenDeLaPagina } from "@/lib/navegacion/volver";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";

/**
 * Tab "Mis students" de Mi espacio (ticket 172): los estudiantes del programa cuyo dueño
 * es el usuario (ADR 0075). Reusa `studentsDelPrograma` con el nuevo filtro `ownerUserId`
 * (no se copia SQL) y muestra una lista compacta; la cohorte, el onboarding y el saldo se
 * editan en la ficha del deal, igual que en la tab Students del programa.
 */
export async function TabMisStudents({
  programId,
  slug,
  userId,
}: {
  programId: string;
  slug: string;
  userId: string;
}) {
  const filas = await studentsDelPrograma(db, programId, { ownerUserId: userId });
  const origen = origenDeLaPagina("/mi-espacio", { programa: slug, tab: "students" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mis estudiantes</CardTitle>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes estudiantes en este programa. Un deal aparece aquí cuando entra en
            Ganado Pago Parcial o Ganado Pagado Completo.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filas.map((f) => {
              const saldo = f.saldo ? saldoLegible(f.saldo.saldo, f.saldo.moneda ?? "USD") : null;
              return (
                <li
                  key={f.dealId}
                  className="relative grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start"
                >
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={enlaceConVuelta(`/p/${slug}/deals/${f.dealId}`, origen)}
                      className="block truncate rounded-md font-medium text-marca-texto underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {f.nombre ?? f.email}
                    </Link>
                    {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={TONO_DE_ETAPA[f.etapa]}>{NOMBRE_DE_ETAPA[f.etapa]}</Badge>
                      <Badge variant="neutro">{f.codigoCohorte ?? "Sin cohorte"}</Badge>
                      {f.onboardedAt ? (
                        <Badge variant="exito">Onboarding {fecha(fechaDeInstanteEnBogota(f.onboardedAt))}</Badge>
                      ) : (
                        <Badge variant="alerta">Sin onboarding</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{saldo?.etiqueta ?? "Saldo pendiente"}</p>
                    <p className="cifra">{saldo?.valor ?? "sin precio de contrato registrado"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
