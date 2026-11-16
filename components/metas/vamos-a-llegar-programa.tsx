import type { ReactNode } from "react";
import { Cifra } from "@/components/cifra-con-lista";
import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropsVamosALlegar } from "@/components/metas/vamos-a-llegar";
import type { CifrasDeMeta, cifrasDelNorte } from "@/lib/hub/cifras-del-norte";
import type { VamosALlegar } from "@/lib/queries/vamos-a-llegar";
import { fecha } from "@/lib/format";
import { enlaceConVueltaAFragmento } from "@/lib/navegacion/volver";

type CifrasDelNorte = ReturnType<typeof cifrasDelNorte>;

function ColumnaDelNorte({ titulo, cifras }: { titulo: string; cifras: CifrasDeMeta }) {
  return <section aria-label={titulo} className="min-w-0 space-y-3">
    <h4 className="text-xs font-medium text-muted-foreground">{titulo}</h4>
    <Cifra cifra={cifras.llevamos} className="w-full" mostrarCobertura />
    <dl className="divide-y text-sm">
      {([cifras.faltan, cifras.esperado, cifras.porDiaHabil, cifras.proyeccion]).map((cifra) => cifra ?
        <div key={cifra.concepto} className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-muted-foreground">{cifra.rotulo}</dt>
          <dd><Cifra cifra={cifra} tamano="celda" /></dd>
        </div> : null)}
    </dl>
  </section>;
}

/** La barra ya dice cuánto llevamos, cuánto se esperaba y cuánto vamos atrás; la lista de cierres se abre desde la Cifra. */
function FilaDelNorte({ titulo, cifras, aviso }: {
  titulo: string; cifras: CifrasDelNorte["mes"]; aviso: ReactNode;
}) {
  return <section aria-label={titulo} className="space-y-3">
    <h3 className="text-sm font-medium">{titulo}</h3>
    {aviso}
    <div className="grid gap-4 sm:grid-cols-2">
      <ColumnaDelNorte titulo="Cupos" cifras={cifras.cupos} />
      <ColumnaDelNorte titulo="Vendido (USD)" cifras={cifras.usd} />
    </div>
  </section>;
}

/** Vista del programa: recibe cifras ya armadas por el servidor, sin consultar ni recalcular. */
export function VamosALlegarProgramaVista({ datos, cifras, props }: {
  datos: VamosALlegar; cifras: CifrasDelNorte; props: PropsVamosALlegar;
}) {
  const { programa, configurar, conNombre } = props;
  const configurarLink = configurar
    ? <Button size="sm" variant="link" nativeButton={false} render={<Enlace precarga="nunca" href={enlaceConVueltaAFragmento(configurar.hrefBase, configurar.origen, "cohortes")} />}>Configurar</Button> : null;
  const mesNombre = datos.mes.nombre.split(" ")[0];
  return <Card data-testid="vamos-a-llegar">
    <CardHeader className="space-y-1">
      <CardTitle>¿Vamos a llegar?{conNombre ? ` · ${programa.nombre}` : ""}</CardTitle>
      <p className="text-sm text-muted-foreground">Mes de {mesNombre}{datos.cohorte ? ` y cohorte ${datos.cohorte.codigo}` : ""} · no cambia con los filtros ni con la fecha</p>
    </CardHeader>
    <CardContent className="space-y-6">
      <FilaDelNorte titulo={`Mes de ${mesNombre}`} cifras={cifras.mes} aviso={datos.mes.sinMeta ? configurarLink : null} />
      {datos.cohorte && cifras.cohorte ? <FilaDelNorte
        titulo={`Cohorte ${datos.cohorte.codigo}${datos.cohorte.cierre ? ` · cierra ${fecha(datos.cohorte.cierre)}` : ""}`}
        cifras={cifras.cohorte}
        aviso={<>{datos.cohorte.cuadrante.cupos.proyeccion === null && datos.cohorte.razonProyeccion
          ? <p className="text-xs text-muted-foreground">{datos.cohorte.razonProyeccion}</p> : null}{datos.cohorte.sinMeta ? configurarLink : null}</>}
      /> : <section aria-label="Cohorte" className="space-y-1">
        <h3 className="text-sm font-medium">Cohorte</h3>
        <p className="text-sm text-muted-foreground">Sin cohorte activa</p>
        {configurarLink}
      </section>}
    </CardContent>
  </Card>;
}
