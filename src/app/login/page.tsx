import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AuthFlashBanner } from "@/components/auth-flash-banner";
import { isDemoConfigured } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar · GallaDev Workspace",
  robots: "noindex, nofollow",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gris-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          GallaDev Workspace
        </p>
        <h1 className="mt-1 text-xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Herramienta interna. Si has llegado aquí por error, vuelve a{" "}
          <a className="underline" href="https://galladev.com">
            galladev.com
          </a>
          .
        </p>
        <AuthFlashBanner kind="goodbye" />
        <Suspense>
          <LoginForm demoEnabled={isDemoConfigured()} />
        </Suspense>
      </div>
    </div>
  );
}
