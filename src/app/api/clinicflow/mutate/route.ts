import { NextResponse } from "next/server";

import {
  buildPatientNotesValue,
  buildPatientServerPayload,
  getPatientPaymentEntriesFromNotes,
  getPatientRollbackPayload,
  hydratePatientRow,
  mergePaymentEntries,
  parsePatientNotes,
  type StoredPaymentEntry,
} from "@/lib/clinicflow-patient-metadata";
import {
  getFallbackClinicData,
  getSeedPatientFullNameById,
  getSeedPaymentEntriesForPatients,
  getSeedTherapistFullNameById,
} from "@/lib/clinicflow-dashboard";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type MutationRequest =
  | {
      action: "savePatient";
      editingPatientId?: string;
      payload: Record<string, unknown>;
    }
  | {
      action: "saveTherapist";
      editingTherapistId?: string;
      payload: Record<string, unknown>;
    }
  | {
      action: "deleteTherapist";
      therapistId: string;
    }
  | {
      action: "savePayment";
      patientId: string;
      amount: number;
      method: string;
      category: string;
      note?: string;
    }
  | {
      action: "updatePayment";
      paymentId: string;
      patientId: string;
      amount: number;
      method: string;
      category: string;
      note?: string;
    }
  | {
      action: "deletePayment";
      paymentId: string;
      patientId: string;
    }
  | {
      action: "saveJournal";
      patientId: string;
      patientPayload: Record<string, unknown>;
      journalPayload?: Record<string, unknown> | null;
    }
  | {
      action: "saveAppointment";
      editingAppointmentId?: string;
      payload: Record<string, unknown>;
    }
  | {
      action: "updatePatientStatus";
      patientId: string;
      status: string;
    }
  | {
      action: "deleteAppointment";
      appointmentId: string;
    }
  | {
      action: "deletePatient";
      patientId: string;
    };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MutationRequest;
    const supabase = getServerSupabaseClient();

    const isMissingPaymentEntriesTableError = (message?: string | null) =>
      Boolean(message?.includes("Could not find the table 'public.payment_entries'"));

    async function resolveStoredPatientId(patientId?: string | null) {
      if (!patientId) {
        return null;
      }

      if (isUuid(patientId)) {
        return patientId;
      }

      const seedFullName = getSeedPatientFullNameById(patientId);
      if (!seedFullName) {
        return patientId;
      }

      const patientLookupResult = await supabase
        .from("patients")
        .select("id")
        .eq("full_name", seedFullName)
        .single();

      return patientLookupResult.data?.id ?? patientId;
    }

    async function resolveStoredTherapistId(therapistId?: string | null) {
      if (!therapistId) {
        return null;
      }

      if (isUuid(therapistId)) {
        return therapistId;
      }

      const seedFullName = getSeedTherapistFullNameById(therapistId);
      if (!seedFullName) {
        return therapistId;
      }

      const therapistLookupResult = await supabase
        .from("therapists")
        .select("id")
        .eq("full_name", seedFullName)
        .single();

      return therapistLookupResult.data?.id ?? therapistId;
    }

    async function resolveStoredAppointmentId(appointmentId?: string | null) {
      if (!appointmentId) {
        return null;
      }

      if (isUuid(appointmentId)) {
        return appointmentId;
      }

      const fallbackAppointment = getFallbackClinicData().appointments.find(
        (appointment) => appointment.id === appointmentId,
      );

      if (!fallbackAppointment) {
        return appointmentId;
      }

      const resolvedPatientId = await resolveStoredPatientId(fallbackAppointment.patient_id);
      if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
        return appointmentId;
      }

      const appointmentLookupResult = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", resolvedPatientId)
        .eq("appointment_at", fallbackAppointment.appointment_at)
        .single();

      return appointmentLookupResult.data?.id ?? appointmentId;
    }

    async function loadMergedPatientPayments(
      patient: {
        id: string;
        full_name: string;
        notes: unknown;
        payment_balance?: number | null;
      },
    ) {
      const hydratedPatient = hydratePatientRow(patient);
      const noteEntries = getPatientPaymentEntriesFromNotes(patient.id, patient.notes);
      const paymentLookupResult = await supabase
        .from("payment_entries")
        .select("*")
        .eq("patient_id", patient.id)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

      const tableEntries = (paymentLookupResult.data ?? []) as StoredPaymentEntry[];
      const mergedEntries = mergePaymentEntries(
        tableEntries,
        noteEntries as StoredPaymentEntry[],
      ) as StoredPaymentEntry[];
      const seededEntries = getSeedPaymentEntriesForPatients(
        [hydratedPatient],
        mergedEntries,
      ) as StoredPaymentEntry[];
      const resolvedEntries = mergePaymentEntries(mergedEntries, seededEntries) as StoredPaymentEntry[];

      return {
        entries: resolvedEntries,
        paymentTableMissing: isMissingPaymentEntriesTableError(paymentLookupResult.error?.message),
        error: paymentLookupResult.error?.message ?? null,
      };
    }

    switch (body.action) {
      case "savePatient": {
        const resolvedEditingPatientId = await resolveStoredPatientId(body.editingPatientId);
        const resolvedPayload = {
          ...body.payload,
          therapist_id: await resolveStoredTherapistId(
            typeof body.payload.therapist_id === "string"
              ? body.payload.therapist_id
              : null,
          ),
        };
        const existingPatientResult = resolvedEditingPatientId
          ? await supabase.from("patients").select("*").eq("id", resolvedEditingPatientId).single()
          : null;
        const payload = buildPatientServerPayload(
          resolvedPayload,
          existingPatientResult?.data?.notes,
        );
        const query = resolvedEditingPatientId
          ? supabase
              .from("patients")
              .update(payload)
              .eq("id", resolvedEditingPatientId)
              .select("*")
              .single()
          : supabase.from("patients").insert(payload).select("*").single();

        const { data, error } = await query;

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Patient save failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, patient: hydratePatientRow(data) });
      }

      case "saveTherapist": {
        const query = body.editingTherapistId
          ? supabase
              .from("therapists")
              .update(body.payload)
              .eq("id", body.editingTherapistId)
              .select("*")
              .single()
          : supabase.from("therapists").insert(body.payload).select("*").single();

        const { data, error } = await query;

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Therapist save failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, therapist: data });
      }

      case "deleteTherapist": {
        const resolvedTherapistId = await resolveStoredTherapistId(body.therapistId);

        if (!resolvedTherapistId) {
          return NextResponse.json({ ok: false, error: "Therapist lookup failed" }, { status: 500 });
        }

        const affectedPatientsResult = await supabase
          .from("patients")
          .select("id")
          .eq("therapist_id", resolvedTherapistId);

        if (affectedPatientsResult.error) {
          return NextResponse.json(
            { ok: false, error: affectedPatientsResult.error.message },
            { status: 500 },
          );
        }

        const detachResult = await supabase
          .from("patients")
          .update({ therapist_id: null })
          .eq("therapist_id", resolvedTherapistId);

        if (detachResult.error) {
          return NextResponse.json(
            { ok: false, error: detachResult.error.message },
            { status: 500 },
          );
        }

        const { error } = await supabase
          .from("therapists")
          .delete()
          .eq("id", resolvedTherapistId);

        if (error) {
          const affectedPatientIds =
            affectedPatientsResult.data?.map((patient) => patient.id) ?? [];

          if (affectedPatientIds.length > 0) {
            await supabase
              .from("patients")
              .update({ therapist_id: resolvedTherapistId })
              .in("id", affectedPatientIds);
          }

          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
      }

      case "saveJournal": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const currentPatientResult = await supabase
          .from("patients")
          .select("*")
          .eq("id", resolvedPatientId)
          .single();

        if (currentPatientResult.error || !currentPatientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: currentPatientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        const nextPatientPayload = buildPatientServerPayload(
          {
            ...body.patientPayload,
            therapist_id: await resolveStoredTherapistId(
              typeof body.patientPayload.therapist_id === "string"
                ? body.patientPayload.therapist_id
                : null,
            ),
          },
          currentPatientResult.data.notes,
        );
        const patientResult = await supabase
          .from("patients")
          .update(nextPatientPayload)
          .eq("id", resolvedPatientId)
          .select("*")
          .single();

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient update failed",
            },
            { status: 500 },
          );
        }

        let journalEntry = null;

        if (body.journalPayload) {
          const normalizedJournalPayload = {
            ...body.journalPayload,
            patient_id: resolvedPatientId,
            therapist_id: await resolveStoredTherapistId(
              typeof body.journalPayload.therapist_id === "string"
                ? body.journalPayload.therapist_id
                : null,
            ),
          };
          const journalResult = await supabase
            .from("journal_entries")
            .insert(normalizedJournalPayload)
            .select("*")
            .single();

          if (journalResult.error || !journalResult.data) {
            await supabase
              .from("patients")
              .update(getPatientRollbackPayload(currentPatientResult.data))
              .eq("id", resolvedPatientId);

            return NextResponse.json(
              {
                ok: false,
                error: journalResult.error?.message ?? "Journal save failed",
              },
              { status: 500 },
            );
          }

          journalEntry = journalResult.data;
        }

        return NextResponse.json({
          ok: true,
          patient: hydratePatientRow(patientResult.data),
          journalEntry,
        });
      }

      case "savePayment": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const patientResult = await supabase
          .from("patients")
          .select("*")
          .eq("id", resolvedPatientId)
          .single();

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        const currentBilling = await loadMergedPatientPayments(
          {
            id: resolvedPatientId,
            full_name: patientResult.data.full_name,
            notes: patientResult.data.notes,
            payment_balance: patientResult.data.payment_balance,
          },
        );
        const currentBalance = parsePatientNotes(patientResult.data.notes).paymentBalance ?? 0;
        const nextPaymentEntry: StoredPaymentEntry = {
          id: crypto.randomUUID(),
          patient_id: resolvedPatientId,
          created_at: new Date().toISOString(),
          payment_date: new Date().toISOString(),
          amount: Number(body.amount),
          method: body.method,
          status: "completed",
          category: body.category,
          note: body.note?.trim() || null,
        };
        const nextBalance =
          Number(currentBalance) - Number(body.amount);
        const nextNotes = buildPatientNotesValue(patientResult.data.notes, {
          paymentBalance: nextBalance,
          paymentEntries: [nextPaymentEntry, ...currentBilling.entries],
        });
        const patientUpdateResult = await supabase
          .from("patients")
          .update({ notes: nextNotes })
          .eq("id", resolvedPatientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Payment save failed",
            },
            { status: 500 },
          );
        }

        const mirrorInsertResult = await supabase
          .from("payment_entries")
          .insert(nextPaymentEntry)
          .select("*")
          .single();

        const warnings: string[] = [];
        if (
          mirrorInsertResult.error
          && !isMissingPaymentEntriesTableError(mirrorInsertResult.error.message)
        ) {
          warnings.push(mirrorInsertResult.error.message);
        }

        return NextResponse.json({
          ok: true,
          paymentEntry: nextPaymentEntry,
          patient: hydratePatientRow(patientUpdateResult.data),
          warnings,
        });
      }

      case "updatePayment": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const patientResult = await supabase
          .from("patients")
          .select("*")
          .eq("id", resolvedPatientId)
          .single();

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        const currentBilling = await loadMergedPatientPayments(
          {
            id: resolvedPatientId,
            full_name: patientResult.data.full_name,
            notes: patientResult.data.notes,
            payment_balance: patientResult.data.payment_balance,
          },
        );
        const existingPayment = currentBilling.entries.find(
          (entry) => entry.id === body.paymentId,
        );

        if (!existingPayment) {
          return NextResponse.json(
            {
              ok: false,
              error: "Payment lookup failed",
            },
            { status: 500 },
          );
        }

        const nextPaymentEntry: StoredPaymentEntry = {
          ...existingPayment,
          amount: Number(body.amount),
          method: body.method,
          category: body.category,
          note: body.note?.trim() || null,
        };

        const previousAmount = Number(existingPayment.amount ?? 0);
        const nextAmount = Number(body.amount);
        const nextBalance =
          Number(parsePatientNotes(patientResult.data.notes).paymentBalance ?? 0)
          - (nextAmount - previousAmount);
        const nextNotes = buildPatientNotesValue(patientResult.data.notes, {
          paymentBalance: nextBalance,
          paymentEntries: currentBilling.entries.map((entry) =>
            entry.id === body.paymentId
              ? nextPaymentEntry
              : entry),
        });

        const patientUpdateResult = await supabase
          .from("patients")
          .update({ notes: nextNotes })
          .eq("id", resolvedPatientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Payment update failed",
            },
            { status: 500 },
          );
        }

        const mirrorUpdateResult = await supabase
          .from("payment_entries")
          .update({
            amount: body.amount,
            method: body.method,
            category: body.category,
            note: body.note?.trim() || null,
          })
          .eq("id", body.paymentId)
          .select("*")
          .single();

        const warnings: string[] = [];
        if (
          mirrorUpdateResult.error
          && !isMissingPaymentEntriesTableError(mirrorUpdateResult.error.message)
        ) {
          warnings.push(mirrorUpdateResult.error.message);
        }

        return NextResponse.json({
          ok: true,
          paymentEntry: nextPaymentEntry,
          patient: hydratePatientRow(patientUpdateResult.data),
          warnings,
        });
      }

      case "deletePayment": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const patientResult = await supabase
          .from("patients")
          .select("*")
          .eq("id", resolvedPatientId)
          .single();

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        const currentBilling = await loadMergedPatientPayments(
          {
            id: resolvedPatientId,
            full_name: patientResult.data.full_name,
            notes: patientResult.data.notes,
            payment_balance: patientResult.data.payment_balance,
          },
        );
        const existingPayment = currentBilling.entries.find(
          (entry) => entry.id === body.paymentId,
        );

        if (!existingPayment) {
          return NextResponse.json(
            {
              ok: false,
              error: "Payment lookup failed",
            },
            { status: 500 },
          );
        }

        const nextBalance =
          Number(parsePatientNotes(patientResult.data.notes).paymentBalance ?? 0) +
          Number(existingPayment.amount ?? 0);
        const nextNotes = buildPatientNotesValue(patientResult.data.notes, {
          paymentBalance: nextBalance,
          paymentEntries: currentBilling.entries.filter(
            (entry) => entry.id !== body.paymentId,
          ),
        });
        const patientUpdateResult = await supabase
          .from("patients")
          .update({ notes: nextNotes })
          .eq("id", resolvedPatientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Payment delete failed",
            },
            { status: 500 },
          );
        }

        const mirrorDeleteResult = await supabase
          .from("payment_entries")
          .delete()
          .eq("id", body.paymentId);

        const warnings: string[] = [];
        if (
          mirrorDeleteResult.error
          && !isMissingPaymentEntriesTableError(mirrorDeleteResult.error.message)
        ) {
          warnings.push(mirrorDeleteResult.error.message);
        }

        return NextResponse.json({
          ok: true,
          patient: hydratePatientRow(patientUpdateResult.data),
          warnings,
        });
      }

      case "saveAppointment": {
        const resolvedAppointmentId = await resolveStoredAppointmentId(body.editingAppointmentId);
        const normalizedPayload = {
          ...body.payload,
          patient_id: await resolveStoredPatientId(
            typeof body.payload.patient_id === "string"
              ? body.payload.patient_id
              : null,
          ),
          therapist_id: await resolveStoredTherapistId(
            typeof body.payload.therapist_id === "string"
              ? body.payload.therapist_id
              : null,
          ),
        };
        const query = resolvedAppointmentId
          ? supabase
              .from("appointments")
              .update(normalizedPayload)
              .eq("id", resolvedAppointmentId)
              .select("*")
              .single()
          : supabase.from("appointments").insert(normalizedPayload).select("*").single();

        const { data, error } = await query;

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Appointment save failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, appointment: data });
      }

      case "updatePatientStatus": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const { data, error } = await supabase
          .from("patients")
          .update({ status: body.status })
          .eq("id", resolvedPatientId)
          .select("*")
          .single();

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Status update failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, patient: hydratePatientRow(data) });
      }

      case "deleteAppointment": {
        const resolvedAppointmentId = await resolveStoredAppointmentId(body.appointmentId);

        if (!resolvedAppointmentId) {
          return NextResponse.json({ ok: false, error: "Appointment lookup failed" }, { status: 500 });
        }

        const { error } = await supabase
          .from("appointments")
          .delete()
          .eq("id", resolvedAppointmentId);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
      }

      case "deletePatient": {
        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId) {
          return NextResponse.json({ ok: false, error: "Patient lookup failed" }, { status: 500 });
        }

        const journalDeleteResult = await supabase
          .from("journal_entries")
          .delete()
          .eq("patient_id", resolvedPatientId);

        if (journalDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: journalDeleteResult.error.message },
            { status: 500 },
          );
        }

        const appointmentDeleteResult = await supabase
          .from("appointments")
          .delete()
          .eq("patient_id", resolvedPatientId);

        if (appointmentDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: appointmentDeleteResult.error.message },
            { status: 500 },
          );
        }

        const paymentDeleteResult = await supabase
          .from("payment_entries")
          .delete()
          .eq("patient_id", resolvedPatientId);

        if (
          paymentDeleteResult.error
          && !isMissingPaymentEntriesTableError(paymentDeleteResult.error.message)
        ) {
          return NextResponse.json(
            { ok: false, error: paymentDeleteResult.error.message },
            { status: 500 },
          );
        }

        const patientDeleteResult = await supabase
          .from("patients")
          .delete()
          .eq("id", resolvedPatientId);

        if (patientDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: patientDeleteResult.error.message },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clinic mutation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
