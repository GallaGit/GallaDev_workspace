import { permanentRedirect } from "next/navigation";
import {
  correoPath,
  folderFromSlug,
  isThreadId,
  parseAccountParam,
  resolveFolderAlias,
} from "@/lib/email/correo-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ folder: string; threadId: string }>;
  searchParams: SearchParams;
}) {
  const { folder, threadId } = await params;
  const known = folderFromSlug(folder);
  const validThread = isThreadId(threadId) && known !== "drafts";
  if (known && validThread) return null;
  const query = await searchParams;
  const cuenta = Array.isArray(query.cuenta) ? query.cuenta[0] : query.cuenta;
  permanentRedirect(
    correoPath(
      resolveFolderAlias(folder),
      validThread ? threadId : null,
      parseAccountParam(cuenta),
    ),
  );
}
