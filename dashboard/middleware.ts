import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Skip auth check for auth API routes
    if (pathname.startsWith("/api/auth")) {
      return NextResponse.next();
    }

    const cookieHeader = request.headers.get("cookie") || "";
    const hasSession =
      cookieHeader.includes("better-auth.session_token") ||
      cookieHeader.includes("__Secure-better-auth.session_token");

    const isLogin = pathname === "/login";

    if (!hasSession && !isLogin) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (hasSession && isLogin) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch (err) {
    console.error("[Middleware] Execution error:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
