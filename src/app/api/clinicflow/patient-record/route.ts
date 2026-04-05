import { NextResponse } from "next/server";

import { getServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ ok: false, error: "patientId is required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const [journalResult, paymentsResult] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("*")
        .eq("patient_id", patientId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("payment_entries")
        .select("*")
        .eq("patient_id", patientId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      ok: true,
      journalEntries: journalResult.data ?? [],
      paymentEntries: paymentsResult.data ?? [],
      errors: {
        journalEntries: journalResult.error?.message ?? null,
        paymentEntries: paymentsResult.error?.message ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patient record load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
