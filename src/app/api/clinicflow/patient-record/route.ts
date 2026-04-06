import { NextResponse } from "next/server";

import {
  getPatientPaymentEntriesFromNotes,
  hydratePatientRow,
  mergePaymentEntries,
  type StoredPaymentEntry,
} from "@/lib/clinicflow-patient-metadata";
import {
  getClinicDashboardData,
  getSeedPatientFullNameById,
  getSeedPaymentEntriesForPatients,
  resolvePatientIdFromKnownData,
} from "@/lib/clinicflow-dashboard";
import { getSupabaseClient } from "@/lib/supabase";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json({ ok: false, error: "patientId is required" }, { status: 400 });
  }

  try {
    const dashboardData = await getClinicDashboardData();
    const requestedSeedFullName = getSeedPatientFullNameById(patientId);
    const resolvedDashboardPatientId = resolvePatientIdFromKnownData(
      patientId,
      dashboardData.patients,
    );
    const dashboardPatient =
      dashboardData.patients.find((patient) => patient.id === resolvedDashboardPatientId)
      ?? dashboardData.patients.find((patient) => patient.full_name === requestedSeedFullName);
    const fallbackPaymentEntries = dashboardPatient
      ? dashboardData.paymentEntries.filter((entry) => entry.patient_id === dashboardPatient.id)
      : [];

    let supabase;
    try {
      supabase = getServerSupabaseClient();
    } catch {
      supabase = getSupabaseClient();
    }

    const resolvedPatientId = isUuid(resolvedDashboardPatientId)
      ? resolvedDashboardPatientId
      : (dashboardPatient && isUuid(dashboardPatient.id) ? dashboardPatient.id : patientId);

    const [patientResult, journalResult, paymentsResult] = await Promise.all([
      isUuid(resolvedPatientId)
        ? supabase.from("patients").select("*").eq("id", resolvedPatientId).single()
        : Promise.resolve({ data: null, error: null }),
      isUuid(resolvedPatientId)
        ? supabase
            .from("journal_entries")
            .select("*")
            .eq("patient_id", resolvedPatientId)
            .order("entry_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
      isUuid(resolvedPatientId)
        ? supabase
            .from("payment_entries")
            .select("*")
            .eq("patient_id", resolvedPatientId)
            .order("payment_date", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const hydratedPatient = patientResult.data
      ? hydratePatientRow(patientResult.data)
      : dashboardPatient ?? null;
    const notePaymentEntries = patientResult.data
      ? getPatientPaymentEntriesFromNotes(resolvedPatientId, patientResult.data.notes)
      : [];
    const mergedPaymentEntries = mergePaymentEntries(
      (paymentsResult.data ?? []) as StoredPaymentEntry[],
      notePaymentEntries as StoredPaymentEntry[],
    );
    const seedPaymentEntries = hydratedPatient
      ? getSeedPaymentEntriesForPatients(
          [hydratedPatient],
          mergedPaymentEntries as StoredPaymentEntry[],
        )
      : [];
    const resolvedPaymentEntries = mergePaymentEntries(
      mergedPaymentEntries as StoredPaymentEntry[],
      seedPaymentEntries as StoredPaymentEntry[],
    );
    const finalPaymentEntries = resolvedPaymentEntries.length > 0
      ? resolvedPaymentEntries
      : fallbackPaymentEntries;
    const paymentTableMissing =
      paymentsResult.error?.message?.includes("Could not find the table 'public.payment_entries'")
      ?? false;

    return NextResponse.json({
      ok: true,
      patient: hydratedPatient,
      journalEntries: journalResult.data ?? [],
      paymentEntries: finalPaymentEntries,
      errors: {
        journalEntries: journalResult.error?.message ?? null,
        paymentEntries:
          paymentTableMissing && finalPaymentEntries.length > 0
            ? null
            : (paymentTableMissing ? null : (paymentsResult.error?.message ?? null)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patient record load failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
