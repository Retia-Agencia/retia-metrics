import { handlers } from "@/lib/auth";

/** Runtime Node: el callback signIn consulta la base de datos. */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
