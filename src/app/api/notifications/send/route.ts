import { NextResponse } from "next/server";

import {
  type ReminderAudience,
  type ReminderKind,
  sendAppointmentNotices,
} from "@/lib/notifications";

export const runtime = "nodejs";

type RequestBody = {
  appointmentId?: string;
  kind?: ReminderKind;
  audiences?: ReminderAudience[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.appointmentId || !body.kind) {
      return NextResponse.json(
        { error: "appointmentId and kind are required" },
        { status: 400 },
      );
    }

    const audiences =
      body.audiences && body.audiences.length > 0
        ? body.audiences
        : (["patient", "therapist"] as ReminderAudience[]);

    const results = await sendAppointmentNotices(body.appointmentId, body.kind, audiences);

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification send failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
