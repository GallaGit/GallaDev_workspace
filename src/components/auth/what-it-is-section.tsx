"use client";

import { useTranslations } from "next-intl";

export const WHAT_IT_IS_SHOTS = [
  {
    src: "/what-it-is/leads-light.webp",
    key: "leads",
    width: 1600,
    height: 1000,
  },
  {
    src: "/what-it-is/kanban-light.webp",
    key: "kanban",
    width: 1600,
    height: 1000,
  },
  {
    src: "/what-it-is/stats-light.webp",
    key: "stats",
    width: 1600,
    height: 1000,
  },
  {
    src: "/what-it-is/detail-light.webp",
    key: "detail",
    width: 1600,
    height: 1000,
  },
] as const;

export function WhatIsItSection() {
  const t = useTranslations("auth.whatIsIt");

  return (
    <section
      data-testid="what-it-is"
      aria-labelledby="what-it-is-title"
      className="w-full max-w-xl"
    >
      <h2 id="what-it-is-title" className="text-xl font-bold">
        {t("title")}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <p>{t("p1")}</p>
        <p>{t("p2")}</p>
        <p>{t("p3")}</p>
      </div>
      <ul className="mt-6 space-y-6">
        {WHAT_IT_IS_SHOTS.map((shot) => (
          <li key={shot.src}>
            <figure>
              {/* Imágenes estáticas de public/; loading lazy para no bloquear el formulario. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={t(`shots.${shot.key}.alt`)}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-lg border border-gray-200 shadow-sm dark:border-gray-700"
              />
              <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <strong className="font-semibold text-gray-800 dark:text-gray-100">
                  {t(`shots.${shot.key}.lead`)}
                </strong>{" "}
                {t(`shots.${shot.key}.caption`)}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
