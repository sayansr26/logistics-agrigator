import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware for route protection
 *
 * This middleware runs on the Edge Runtime and handles:
 * - Authentication checks for protected routes
 * - Role-based access control
 * - Redirects for unauthorized access
 *
 * Note: Edge runtime has limitations, so complex auth logic is handled client-side
 */

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  // Customer-facing parcel tracking. Recipients are not users of the panel and
  // must never be bounced to a login screen; the page itself only reads the
  // sanitised public tracking endpoint.
  "/track",
  "/privacy",
  "/terms",
  "/about",
  "/contact",
];

// Routes that require specific roles
const ROLE_RESTRICTED_ROUTES: Record<string, string[]> = {
  "/users": ["superadmin", "admin"],
  "/users/add": ["superadmin"],
  "/clients": ["superadmin"],
  "/partners": ["superadmin", "admin"],
  "/settings/system": ["superadmin", "admin"],
  "/analytics/admin": ["superadmin", "admin"],
  // External API credentials act as an outlet and can move that outlet's money,
  // so only the outlet itself and superadmin may manage them.
  "/developers": ["superadmin", "outlet"],
};

// Routes that require authentication but any role can access
const AUTH_REQUIRED_ROUTES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/notifications",
  "/developers",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") || // Files with extensions
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get auth token from cookies.
  //
  // This is a presence check only - the edge runtime cannot verify a JWT
  // cheaply, and an expired access token is still a live session (the API
  // layer refreshes it transparently). The cookie is written with the
  // *refresh* token's lifetime, so it means "a session may exist"; the real
  // authentication decision happens client-side once Redux has hydrated.
  const token = request.cookies.get("token")?.value;
  const userRole = request.cookies.get("userRole")?.value;

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check role-restricted routes
  for (const [route, allowedRoles] of Object.entries(ROLE_RESTRICTED_ROUTES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      if (!userRole || !allowedRoles.includes(userRole)) {
        // User doesn't have required role - redirect to access denied
        const deniedUrl = new URL("/access-denied", request.url);
        deniedUrl.searchParams.set("required", allowedRoles.join(","));
        deniedUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(deniedUrl);
      }
    }
  }

  // User has token and meets role requirements - allow access
  return NextResponse.next();
}

// Configuration for which paths middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
