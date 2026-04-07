import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  CLINICFLOW_ACCESS_COOKIE,
  CLINICFLOW_UNLOCK_PATH,
  isClinicAccessEnabled,
  isValidClinicAccessToken,
} from "@/lib/clinicflow-access-gate";

function isPublicPath(pathname: string) {
  return (
    pathname === CLINICFLOW_UNLOCK_PATH
    || pathname.startsWith("/api/clinicflow/access")
    || pathname.startsWith("/api/reminders/run")
    || pathname.startsWith("/api/notifications/send")
    || pathname.startsWith("/_next")
    || pathname.startsWith("/icon")
    || pathname.startsWith("/apple-icon")
    || pathname.startsWith("/manifest")
    || pathname === "/favicon.ico"
  );
}

export function proxy(request: NextRequest) {
  if (!isClinicAccessEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessCookie = request.cookies.get(CLINICFLOW_ACCESS_COOKIE)?.value;

  if (isValidClinicAccessToken(accessCookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/clinicflow")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const unlockUrl = new URL(CLINICFLOW_UNLOCK_PATH, request.url);
  unlockUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ["/((?!.*\\.[\\w]+$).*)", "/(api|trpc)(.*)"],
};

