import { paginaConRol } from "@/lib/auth/page-guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { estadoConexionMeta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { fechaHoraEnBogota } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConexionMeta } from "./conexion-meta";

export const dynamic = "force-dynamic";

export default async function MetaPage() {
  const session = await paginaConRol("gerente", "paid_trafficker");
  if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  const estado = await estadoConexionMeta(db);

  return (
    <PageShell
      titulo="Meta"
      descripcion="Conexión de solo lectura con las cuentas publicitarias."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Conexión
            <Badge variant={estado.conectada ? "exito" : "neutro"}>
              {estado.conectada ? "Conectada" : "Sin conectar"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {estado.conectada
              ? `Conectada como ${estado.nombre} desde ${fechaHoraEnBogota(estado.desde)}.`
              : "Meta todavía no está conectada."}
          </p>
          <ConexionMeta />
          <p className="text-xs text-muted-foreground">
            El token nunca vuelve a mostrarse. Pegar uno nuevo reemplaza la conexión actual.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
