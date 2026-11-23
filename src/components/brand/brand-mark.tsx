import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Isotipo GallaDev. Sustituye el cuadrado de acento del sidebar.
 * Granate sobre tema claro, crema sobre tema oscuro (clase `.dark`).
 */
export function BrandMark({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/logo.png"
        alt="GallaDev"
        width={size}
        height={size}
        className="h-full w-full object-contain dark:hidden"
        priority
      />
      <Image
        src="/brand/logo-light.png"
        alt=""
        width={size}
        height={size}
        className="hidden h-full w-full object-contain dark:block"
        aria-hidden
        priority
      />
    </span>
  );
}
