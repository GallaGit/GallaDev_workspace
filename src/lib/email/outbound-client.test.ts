import { describe, expect, it } from "vitest";
import { buildOutboundInit } from "./outbound-client";

describe("buildOutboundInit", () => {
  it("sin adjuntos envía JSON", () => {
    const init = buildOutboundInit({ to: "a@x.com", text: "hola" }, []);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ to: "a@x.com", text: "hola" });
  });

  it("con adjuntos envía multipart con payload y files, sin Content-Type manual", () => {
    const file = new File(["contenido"], "nota.txt", { type: "text/plain" });
    const init = buildOutboundInit({ text: "hola" }, [file]);
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(JSON.parse(String(form.get("payload")))).toEqual({ text: "hola" });
    const files = form.getAll("files") as File[];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("nota.txt");
  });
});
