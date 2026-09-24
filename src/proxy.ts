import { type NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db-client";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const db = createDbClient({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options}) => response.cookies.set(name, value, options));
    }
  })

  const {
    data: { user },
  } = await db.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const isPendingPage = pathname === "/pending-approval";
  const isRejectedPage = pathname === "/rejected";

  const redirect = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      });
    });
    return redirectResponse;
  };

  // Handle Unauthenticated State
  if (!user) {
    if (isDashboard || isPendingPage || isRejectedPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      return redirect(url);
    }
    return response;
  }

  // Fetch user status from profiles
  let status = "pending";
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Middleware profiles query error:", profileError);
  }

  if (profile) {
    status = (profile as { status: string }).status;
  }

  // Routing rules based on registration status
  if (status === "pending") {
    if (!isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      return redirect(url);
    }
    return response;
  }

  if (status === "rejected") {
    if (!isRejectedPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/rejected";
      return redirect(url);
    }
    return response;
  }

  // Approved status rules
  if (status === "approved") {
    if (isAuthPage || isPendingPage || isRejectedPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return redirect(url);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
