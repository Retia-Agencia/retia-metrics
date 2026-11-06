import { protectedResourceHandler } from "mcp-handler";

/** El ticket 383 agregará aquí los servidores de autorización. */
export const recursoProtegido = protectedResourceHandler({ authServerUrls: [] });
