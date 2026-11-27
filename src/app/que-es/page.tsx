import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WhatIsItSection } from "@/components/auth/what-it-is-section";
import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.whatIsIt");
  return {
    title: `${t("title")} · GallaDev ${t("brand")}`,
    robots: "noindex, nofollow",
  };
}

export default async function WhatIsItPage() {
  const t = await getTranslations("auth.whatIsIt");

  return (
    <div className="flex min-h-full flex-1 justify-center p-6">
      <div className="w-full max-w-xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandMark size={20} />
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              GallaDev {t("brand")}
            </p>
          </div>
          <LocaleSwitcher size="md" />
        </header>
        <div className="mt-8">
          <WhatIsItSection />
        </div>
        <p className="mt-8 text-sm">
          <a
            href="/login"
            data-testid="what-it-is-back"
            className="underline text-gray-600 hover:text-gray-800 dark:text-gray-300"
          >
            {t("back")}
          </a>
        </p>
      </div>
    </div>
  );
}
