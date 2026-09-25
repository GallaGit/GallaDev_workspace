import { VISITOR_TTL_SECONDS } from "./config";

export function visitorCookieOptions(maxAge = VISITOR_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
