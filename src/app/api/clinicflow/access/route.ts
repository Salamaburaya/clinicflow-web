import { NextResponse } from "next/server";

import {
  buildClinicAccessCookieValue,
  CLINICFLOW_ACCESS_COOKIE,
  isClinicAccessEnabled,
} from "@/lib/clinicflow-access-gate";

export const runtime = "nodejs";

type AccessRequest = {
  password?: string;
};

export async function POST(request: Request) {
  if (!isClinicAccessEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const body = (await request.json().catch(() => ({}))) as AccessRequest;
  const password = body.password?.trim() ?? "";
  const expected = process.env.CLINICFLOW_ACCESS_PASSWORD?.trim() ?? "";

  if (!password || password !== expected) {
    return NextResponse.json(
      { ok: false, error: "סיסמת הגישה שגויה" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLINICFLOW_ACCESS_COOKIE, buildClinicAccessCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLINICFLOW_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

