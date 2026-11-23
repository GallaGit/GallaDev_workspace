import { CorreoContent } from "@/components/correo/correo-content";

/**
 * La barra de correo y el estado del módulo viven en AppShell (sustituyen a la
 * barra general). Aquí solo va el área ancha: hilo abierto, redacción o vacío.
 * Las páginas hijas no pintan nada; solo validan la URL y redirigen.
 */
export default function CorreoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CorreoContent />
      {children}
    </>
  );
}
