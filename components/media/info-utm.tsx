/**
 * La pestaña "Info UTM" de /media: explica, en lenguaje de media, como se arma el link de cada
 * pieza y que hace el CRM con el. Es la lectura humana del ADR 0108; si el contrato cambia, se
 * cambia alla y aqui. Pagina de servidor: no hay estado.
 */
import { parametrosDeContenido } from "@/lib/atribucion/parametros-de-contenido";

const fila = "grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_1fr_1fr] sm:gap-4";

export function InfoUtmDeMedia({ medio, redes }: { medio: string; redes: readonly string[] }) {
  const parametros = parametrosDeContenido(redes);
  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-2">
        <h2 className="text-base font-medium">Para qué sirve</h2>
        <p className="text-sm text-muted-foreground">
          Cuando alguien entra al formulario desde el link de una pieza, el lead queda marcado con esa pieza. Así el CRM
          cruza cada pieza con sus leads, llamadas y ventas, y media puede ver qué contenido vende y cuál solo llena agenda.
          Todo lo que se publique <b>sin su link</b> llega como orgánico sin pieza: no se pierde el lead, se pierde saber qué lo trajo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium">Qué lleva cada link</h2>
        <div className="divide-y rounded-lg border">
          <div className={`${fila} text-xs font-medium text-muted-foreground`}>
            <span>Parámetro</span><span>De dónde sale</span><span>Ejemplo</span>
          </div>
          {parametros.map((p) => (
            <div key={p.llave} className={fila}>
              <code className="font-mono text-xs">{p.llave}</code>
              <span>{p.sale}</span>
              <code className="font-mono text-xs break-all">{p.ejemplo}</code>
            </div>
          ))}
        </div>
        <p className="break-all rounded-md border bg-muted/40 p-3 font-mono text-xs">
          …/formulario?utm_source=instagram&amp;utm_medium={medio}&amp;utm_campaign=reel_milena_20261030&amp;utm_content=k7p2x9
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium">Reglas</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>El link lo genera el CRM al crear la pieza. Nunca se escribe ni se edita a mano: un typo rompe la atribución sin avisar.</li>
          <li>El destino es el formulario principal del programa del creador. Un creador sin programa no tiene link.</li>
          <li>El texto se normaliza: minúsculas, sin tildes, con guion bajo en vez de espacios.</li>
          <li>El slug del creador y el nombre del tipo viajan en el UTM; los links ya publicados siguen atribuyendo bien porque la pieza se reconoce por su código.</li>
          <li>El link fijo de un creador (bio, perfil) es una pieza “siempre visible”: una por creador y por red.</li>
          <li>El llamado a la acción y las notas no viajan en el UTM: son para el equipo.</li>
          <li>Pauta de Meta es aparte: la arma Meta con sus macros, no este generador.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-medium">Qué hace el CRM con esto</h2>
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">utm_source</code> y <code className="font-mono text-xs">utm_medium</code> ubican el
          lead en el canal (Orgánico › la red). <code className="font-mono text-xs">utm_content</code> lo lee solo el emparejador,
          y solo con medio <code className="font-mono text-xs">{medio}</code>, para ligar el lead a la pieza. Un código que no existe
          sale como aviso, nunca como una asignación inventada.
        </p>
      </section>
    </div>
  );
}
