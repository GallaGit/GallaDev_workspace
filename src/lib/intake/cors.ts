const ALLOWED_ORIGINS = new Set([
  "https://galladev.com",
  "https://www.galladev.com",
  // Local landing / preview
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  if (ALLOWED_ORIGINS.has(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = resolveCorsOrigin(request.headers.get("origin"));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function withCors(request: Request, response: Response): Response {
  const extra = corsHeaders(request);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
