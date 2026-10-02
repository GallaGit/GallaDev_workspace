import { afterEach, describe, expect, it } from "vitest";
import { outboundUrlError, shouldSendN8nApiKey } from "./outbound-url";

afterEach(() => {
  delete process.env.N8N_ALLOWED_HOSTS;
});

describe("outboundUrlError", () => {
  it("acepta https público", () => {
    expect(outboundUrlError("https://n8n.example.com/webhook/abc")).toBeNull();
  });

  it("rechaza http, credenciales y literales privados o de metadatos", () => {
    expect(outboundUrlError("http://n8n.example.com")).toMatch(/https/);
    expect(outboundUrlError("https://user:secret@n8n.example.com")).toMatch(
      /usuario/,
    );
    expect(outboundUrlError("https://127.0.0.1/healthz")).toMatch(/permitido/);
    expect(outboundUrlError("https://169.254.169.254/")).toMatch(/permitido/);
    expect(outboundUrlError("https://10.0.0.5/")).toMatch(/permitido/);
    expect(outboundUrlError("https://192.168.1.1/")).toMatch(/permitido/);
    expect(outboundUrlError("https://[::1]/")).toMatch(/permitido/);
    expect(outboundUrlError("https://metadata.google.internal/")).toMatch(
      /permitido/,
    );
    expect(outboundUrlError("https://localhost/healthz")).toMatch(/permitido/);
  });

  it("si hay lista de hosts, solo esos pasan", () => {
    process.env.N8N_ALLOWED_HOSTS = "n8n.example.com, hooks.example.com";
    expect(outboundUrlError("https://n8n.example.com/hook")).toBeNull();
    expect(outboundUrlError("https://otro.example.com/hook")).toMatch(
      /permitido/,
    );
    expect(outboundUrlError("https://127.0.0.1/")).toMatch(/permitido/);
  });
});

describe("shouldSendN8nApiKey", () => {
  it("solo si el host efectivo es el ya guardado y permitido", () => {
    const saved = "https://n8n.example.com";
    expect(shouldSendN8nApiKey(saved, saved)).toBe(true);
    expect(
      shouldSendN8nApiKey(saved, "https://otro.example.com"),
    ).toBe(false);
    expect(shouldSendN8nApiKey("", "https://n8n.example.com")).toBe(false);
    expect(shouldSendN8nApiKey("http://127.0.0.1", "http://127.0.0.1")).toBe(
      false,
    );
  });
});
