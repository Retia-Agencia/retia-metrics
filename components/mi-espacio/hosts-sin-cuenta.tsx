import type { FilaLlamadaSinCloser } from "@/lib/queries/inbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "Hosts sin cuenta" (tickets 071, 179): citas de Calendly cuya host no tiene cuenta en el
 * CRM, así que no se pudieron colgar de un closer. Se arreglan en el Equipo del programa.
 *
 * Extraído del Inbox del programa (`app/(app)/p/[programa]/inbox/page.tsx`, donde estaba
 * inline) para reusarlo en la sección "Por decidir" de Mi espacio del gerente (179), sin
 * duplicar el markup. Es un componente de servidor: recibe datos planos y no toca la base.
 * No se renderiza si no hay filas (la decisión de mostrar o no la toma quien lo usa, igual
 * que antes).
 */
export function HostsSinCuenta({ filas }: { filas: readonly FilaLlamadaSinCloser[] }) {
  if (filas.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Hosts sin cuenta <Badge variant="destructive">Urgente</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Dale cuenta a esa persona en el Equipo del programa o asigna la cita a un closer.</p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {filas.map((llamada) => (
            <li key={llamada.callId} className="px-4 py-3 text-sm">
              La cita la hospeda {llamada.hostEmail}, que no tiene cuenta en el CRM. Asígnala en el Equipo del programa.
              <span className="block text-xs text-muted-foreground">{llamada.leadNombre ?? llamada.leadEmail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
