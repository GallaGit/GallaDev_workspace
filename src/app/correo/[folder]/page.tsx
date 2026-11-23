import { permanentRedirect } from "next/navigation";
import {
  correoPath,
  folderFromSlug,
  parseAccountParam,
  resolveFolderAlias,
} from "@/lib/email/correo-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ folder: string }>;
  searchParams: SearchParams;
}) {
  const { folder } = await params;
  if (folderFromSlug(folder)) return null;
  const query = await searchParams;
  const cuenta = Array.isArray(query.cuenta) ? query.cuenta[0] : query.cuenta;
  permanentRedirect(
    correoPath(resolveFolderAlias(folder), null, parseAccountParam(cuenta)),
  );
}
