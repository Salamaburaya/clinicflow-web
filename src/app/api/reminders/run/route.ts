import { NextResponse } from "next/server";

import { runScheduledReminderSweep } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runScheduledReminderSweep();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
