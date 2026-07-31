// Explicitly set Node.js runtime for middleware to support Node.js globals on Vercel
export const runtime = "nodejs";

// Shim free variables __dirname and __filename if evaluated in Edge/bundled scope
try {
  // @ts-ignore
  if (typeof __dirname === "undefined") {
    // @ts-ignore
    var __dirname = "";
  }
  // @ts-ignore
  if (typeof __filename === "undefined") {
    // @ts-ignore
    var __filename = "";
  }
} catch {
  // Ignore scope errors
}

import { NextRequest, NextResponse } from "next/server";

/** Cookie-only gate; no better-auth imports (Edge-compatible). */
function hasSessionToken(request: NextRequest): boolean {
  const raw = request.headers.get("cookie");
  if (!raw) return false;
  const names = [
    "__Secure-better-auth.session_token",
    "better-auth.session_token",
    "__Secure-better-auth-session_token",
    "better-auth-session_token",
  ];
  for (const part of raw.split(";")) {
    const name = part.trim().split("=")[0];
    if (name && names.includes(name)) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = hasSessionToken(request);
  const isLogin = pathname === "/login";
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isAuthApi) {
    return NextResponse.next();
  }

  if (!sessionCookie && !isLogin) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
