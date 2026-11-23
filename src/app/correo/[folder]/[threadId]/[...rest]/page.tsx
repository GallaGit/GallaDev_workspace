import { permanentRedirect } from "next/navigation";
import {
  correoPath,
  isThreadId,
  resolveFolderAlias,
} from "@/lib/email/correo-routes";

/** Rutas más profundas que /correo/{carpeta}/{hilo} vuelven a la ruta del hilo. */
export default async function Page({
  params,
}: {
  params: Promise<{ folder: string; threadId: string }>;
}) {
  const { folder, threadId } = await params;
  permanentRedirect(
    correoPath(resolveFolderAlias(folder), isThreadId(threadId) ? threadId : null),
  );
}
