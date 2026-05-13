import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function resolveOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin") ?? "";
  if (allowedOrigins.length === 0) return "";
  if (allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0];
}

export function corsHeaders(req: NextRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export function jsonWithCors(
  req: NextRequest,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const headers = new Headers(init?.headers);
  const cors = corsHeaders(req);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return NextResponse.json(body, { ...init, headers });
}
