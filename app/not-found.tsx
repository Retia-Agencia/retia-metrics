import Link from "next/link";

/**
 * El 404 de ultimo recurso: una URL que no cae en ninguna ruta, incluso sin sesion.
 *
 * No lleva sidebar ni PageShell porque no esta dentro del layout de `(app)`: quien
 * llega aca puede no tener sesion, y el shell de la app asume que si. Lo de adentro
 * de la app lo cubre `app/(app)/not-found.tsx`.
 *
 * Existe por lo mismo que el otro: el de Next viene en ingles y la UI es en espanol.
 */
export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="text-sm text-muted-foreground">
        El enlace puede estar viejo o mal escrito.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Volver al inicio
      </Link>
    </div>
  );
}
