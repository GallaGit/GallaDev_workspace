"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { setAuthFlash } from "@/components/auth-flash-banner";
import { safeAppPath } from "@/lib/auth/safe-redirect";

type LoginErrorKey =
  | "auth.login.errors.generic"
  | "auth.login.errors.rate"
  | "auth.login.errors.config"
  | "auth.login.errors.network"
  | "auth.login.demoFailed";

export function LoginForm({ demoEnabled = false }: { demoEnabled?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => null)) as {
        code?: string;
      } | null;
      if (!res.ok) {
        if (res.status === 429 || data?.code === "rate_limited") {
          setErrorKey("auth.login.errors.rate");
        } else if (data?.code === "config") {
          setErrorKey("auth.login.errors.config");
        } else if (data?.code === "network" || res.status >= 500) {
          setErrorKey("auth.login.errors.network");
        } else {
          setErrorKey("auth.login.errors.generic");
        }
        return;
      }
      setAuthFlash("welcome");
      router.push(safeAppPath(from));
      router.refresh();
    } catch {
      setErrorKey("auth.login.errors.network");
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    setErrorKey(null);
    setDemoBusy(true);
    try {
      const res = await fetch("/api/demo/enter", { method: "POST" });
      if (!res.ok) {
        setErrorKey("auth.login.demoFailed");
        return;
      }
      router.push("/leads");
      router.refresh();
    } catch {
      setErrorKey("auth.login.errors.network");
    } finally {
      setDemoBusy(false);
    }
  }

  const canSubmit = !busy && !demoBusy && email.trim().length > 0 && password.length > 0;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium"
        >
          {t("auth.login.email")}
        </label>
        <input
          id="email"
          data-testid="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-base outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium"
        >
          {t("auth.login.password")}
        </label>
        <div className="relative">
          <input
            id="password"
            data-testid="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-base outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800"
            aria-label={
              showPassword
                ? t("auth.login.hidePassword")
                : t("auth.login.showPassword")
            }
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {t(errorKey)}
        </p>
      ) : null}
      <button
        type="submit"
        data-testid="login-submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("auth.login.submitting") : t("auth.login.submit")}
      </button>
      {demoEnabled ? (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="button"
            data-testid="demo-enter"
            onClick={() => void enterDemo()}
            disabled={demoBusy || busy}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            {demoBusy
              ? t("auth.login.demoOpening")
              : t("auth.login.demoEnter")}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            {t("auth.login.demoHint")}
          </p>
        </div>
      ) : null}
    </form>
  );
}
