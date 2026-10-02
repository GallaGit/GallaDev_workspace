import { NextResponse } from "next/server";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

/**
 * Cualquier throw del handler (auth, params, import perezoso del sanitizer)
 * responde JSON. Un `import` estático que revienta al cargar el módulo
 * sigue siendo un 500 vacío de Next: por eso el sanitizer no se importa
 * en la cabecera de la ruta.
 */
export function withJsonErrors<Args extends unknown[]>(
  route: string,
  handler: (...args: Args) => Promise<Response>,
  options?: { error?: string },
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0];
      let requestId: string | undefined;
      if (request instanceof Request) {
        try {
          requestId = requestIdFrom(request);
        } catch {
          requestId = undefined;
        }
      }
      logRouteError({
        route,
        status: 500,
        errorClass: errorClassOf(error),
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: options?.error ?? "Error interno" },
        { status: 500 },
      );
    }
  };
}
