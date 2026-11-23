import { permanentRedirect } from "next/navigation";
import { correoPath, isThreadId, parseAccountParam } from "@/lib/email/correo-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * /correo no tiene contenido propio: va a Recibidos (308). El enlace antiguo
 * /correo?thread=<id> (ficha del lead) abre ese hilo; la carpeta real la
 * corrige el cliente si el hilo no está en Recibidos.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const thread = first(params.thread);
  permanentRedirect(
    correoPath(
      "inbox",
      isThreadId(thread) ? thread : null,
      parseAccountParam(first(params.cuenta)),
    ),
  );
}
