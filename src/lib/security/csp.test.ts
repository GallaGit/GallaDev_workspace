import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

describe("buildContentSecurityPolicy", () => {
  it("quita unsafe-inline de script-src y conserva el de estilos", () => {
    const csp = buildContentSecurityPolicy("abc+/=", { dev: false });
    const script = csp.split("; ").find((part) => part.startsWith("script-src"));
    const style = csp.split("; ").find((part) => part.startsWith("style-src"));
    expect(script).toBe("script-src 'self' 'nonce-abc+/=' 'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(style).toBe("style-src 'self' 'unsafe-inline'");
    const img = csp.split("; ").find((part) => part.startsWith("img-src"));
    expect(img).toBe("img-src 'self' blob:");
    expect(csp).toContain("connect-src 'self' https: wss:");
  });

  it("permite unsafe-eval solo en desarrollo", () => {
    const csp = buildContentSecurityPolicy("n", { dev: true });
    expect(csp).toContain("script-src 'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
