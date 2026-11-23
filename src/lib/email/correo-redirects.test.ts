import { beforeEach, describe, expect, it, vi } from "vitest";

const permanentRedirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({ permanentRedirect }));

const ID = "11111111-1111-4111-8111-111111111111";

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return message.startsWith("REDIRECT:") ? message.slice("REDIRECT:".length) : null;
  }
}

beforeEach(() => {
  permanentRedirect.mockClear();
});

describe("/correo redirige a Recibidos", () => {
  it("/correo → /correo/recibidos", async () => {
    const { default: Page } = await import("@/app/correo/page");
    expect(await redirectOf(() => Page({ searchParams: Promise.resolve({}) }))).toBe(
      "/correo/recibidos",
    );
  });

  it("conserva la cuenta y el hilo del enlace antiguo ?thread=", async () => {
    const { default: Page } = await import("@/app/correo/page");
    expect(
      await redirectOf(() =>
        Page({ searchParams: Promise.resolve({ thread: ID, cuenta: "ociel" }) }),
      ),
    ).toBe(`/correo/recibidos/${ID}?cuenta=ociel`);
    expect(
      await redirectOf(() => Page({ searchParams: Promise.resolve({ thread: "no-uuid" }) })),
    ).toBe("/correo/recibidos");
  });
});

describe("/correo/[carpeta]", () => {
  it("una carpeta conocida no redirige", async () => {
    const { default: Page } = await import("@/app/correo/[folder]/page");
    for (const folder of ["recibidos", "enviados", "archivados", "papelera", "borradores"]) {
      expect(
        await Page({ params: Promise.resolve({ folder }), searchParams: Promise.resolve({}) }),
      ).toBeNull();
    }
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("una ruta desconocida va a la carpeta equivalente o a Recibidos", async () => {
    const { default: Page } = await import("@/app/correo/[folder]/page");
    const go = (folder: string, query = {}) =>
      redirectOf(() =>
        Page({ params: Promise.resolve({ folder }), searchParams: Promise.resolve(query) }),
      );
    expect(await go("sent")).toBe("/correo/enviados");
    expect(await go("trash", { cuenta: "hola" })).toBe("/correo/papelera?cuenta=hola");
    expect(await go("spam")).toBe("/correo/recibidos");
    expect(await go("recibidos-x", { cuenta: "root" })).toBe("/correo/recibidos");
  });
});

describe("/correo/[carpeta]/[hilo]", () => {
  it("carpeta e id válidos no redirigen", async () => {
    const { default: Page } = await import("@/app/correo/[folder]/[threadId]/page");
    expect(
      await Page({
        params: Promise.resolve({ folder: "archivados", threadId: ID }),
        searchParams: Promise.resolve({ cuenta: "hola" }),
      }),
    ).toBeNull();
  });

  it("un id que no es UUID o una carpeta inválida vuelven a la carpeta", async () => {
    const { default: Page } = await import("@/app/correo/[folder]/[threadId]/page");
    const go = (folder: string, threadId: string) =>
      redirectOf(() =>
        Page({
          params: Promise.resolve({ folder, threadId }),
          searchParams: Promise.resolve({}),
        }),
      );
    expect(await go("enviados", "abc")).toBe("/correo/enviados");
    expect(await go("sent", ID)).toBe(`/correo/enviados/${ID}`);
    expect(await go("borradores", ID)).toBe("/correo/borradores");
    expect(await go("nada", ID)).toBe(`/correo/recibidos/${ID}`);
  });

  it("rutas más profundas vuelven al hilo", async () => {
    const { default: Page } = await import("@/app/correo/[folder]/[threadId]/[...rest]/page");
    expect(
      await redirectOf(() =>
        Page({ params: Promise.resolve({ folder: "papelera", threadId: ID }) }),
      ),
    ).toBe(`/correo/papelera/${ID}`);
  });
});
