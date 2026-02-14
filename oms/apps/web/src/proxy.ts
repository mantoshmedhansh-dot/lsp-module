import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Internal API key for service-to-service communication
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "cjd-internal-api-key-2024";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isSignupPage = req.nextUrl.pathname === "/signup";
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const isPublicRoute = req.nextUrl.pathname === "/";
  const isTrackingPage = req.nextUrl.pathname.startsWith("/track");

  // Allow API auth routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Allow public API routes (no auth needed — backend handles auth)
  if (isApiRoute) {
    const isPublicApi =
      req.nextUrl.pathname.startsWith("/api/v1/platform/onboarding") ||
      req.nextUrl.pathname.startsWith("/api/v1/platform/plans");
    if (isPublicApi) {
      return NextResponse.next();
    }

    // Allow API routes with internal API key
    const apiKey = req.headers.get("x-internal-api-key");
    if (apiKey === INTERNAL_API_KEY) {
      return NextResponse.next();
    }
  }

  // Allow tracking pages without auth (public-facing)
  if (isTrackingPage) {
    return NextResponse.next();
  }

  // Allow signup page without auth
  if (isSignupPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Redirect logged in users away from auth pages
  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect root to dashboard for logged in users
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
