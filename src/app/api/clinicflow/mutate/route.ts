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
import { requestHasClinicAccess } from "@/lib/clinicflow-access-gate";
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

function buildInvalidLookupResponse(entity: string) {
  return NextResponse.json(
    { ok: false, error: `${entity} lookup failed` },
    { status: 404 },
  );
}

function buildInvalidIdentifierResponse(entity: string) {
  return NextResponse.json(
    { ok: false, error: `${entity} identifier is invalid` },
    { status: 400 },
  );
}

function normalizePatientStatus(status: unknown) {
  if (typeof status !== "string") {
    return null;
  }

  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  const aliases: Record<string, string> = {
    "חדש": "חדש",
    new: "חדש",
    intake: "חדש",
    pending: "חדש",
    "בטיפול": "בטיפול",
    active: "בטיפול",
    active_treatment: "בטיפול",
    in_progress: "בטיפול",
    ongoing: "בטיפול",
    "מעקב": "מעקב",
    followup: "מעקב",
    "follow-up": "מעקב",
    monitoring: "מעקב",
    review: "מעקב",
  };

  return aliases[normalized] ?? null;
}

function normalizePatientDiscipline(discipline: unknown) {
  if (typeof discipline !== "string") {
    return null;
  }

  const trimmed = discipline.trim();
  if (trimmed === "פיזיותרפיה" || trimmed === "ריפוי בעיסוק") {
    return trimmed;
  }

  return null;
}

function normalizeTherapistProfession(profession: unknown) {
  return normalizePatientDiscipline(profession);
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAppointmentStatus(status: unknown) {
  if (typeof status !== "string") {
    return null;
  }

  const trimmed = status.trim().toLowerCase();
  const aliases: Record<string, string> = {
    scheduled: "scheduled",
    confirmed: "scheduled",
    completed: "completed",
    done: "completed",
    cancelled: "cancelled",
    canceled: "cancelled",
    no_show: "no_show",
    "no-show": "no_show",
  };

  return aliases[trimmed] ?? null;
}

function normalizeAppointmentDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildAppointmentServerPayload(payload: Record<string, unknown>) {
  return {
    patient_id: payload.patient_id,
    therapist_id: payload.therapist_id ?? null,
    appointment_at: payload.appointment_at,
    room:
      typeof payload.room === "string" && payload.room.trim().length > 0
        ? payload.room.trim()
        : null,
    status: payload.status,
    summary:
      typeof payload.summary === "string" && payload.summary.trim().length > 0
        ? payload.summary.trim()
        : null,
  };
}

function buildTherapistServerPayload(payload: Record<string, unknown>) {
  return {
    full_name:
      typeof payload.full_name === "string" ? payload.full_name.trim() : "",
    profession:
      typeof payload.profession === "string" ? payload.profession.trim() : "",
    specialty:
      typeof payload.specialty === "string" && payload.specialty.trim().length > 0
        ? payload.specialty.trim()
        : null,
    phone:
      typeof payload.phone === "string" && payload.phone.trim().length > 0
        ? payload.phone.trim()
        : null,
  };
}

export async function POST(request: Request) {
  try {
    if (!requestHasClinicAccess(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
        const normalizedPatientStatus = normalizePatientStatus(body.payload.status);
        const normalizedPatientDiscipline = normalizePatientDiscipline(body.payload.discipline);

        if (body.editingPatientId && (!resolvedEditingPatientId || !isUuid(resolvedEditingPatientId))) {
          return buildInvalidLookupResponse("Patient");
        }

        const resolvedPayload = {
          ...body.payload,
          status: normalizedPatientStatus,
          discipline: normalizedPatientDiscipline,
          therapist_id: await resolveStoredTherapistId(
            typeof body.payload.therapist_id === "string"
              ? body.payload.therapist_id
              : null,
          ),
        };
        if (!normalizeRequiredText(body.payload.full_name)) {
          return NextResponse.json(
            { ok: false, error: "Patient full name is required" },
            { status: 400 },
          );
        }
        if (!resolvedPayload.status) {
          return NextResponse.json(
            { ok: false, error: "Patient status is invalid" },
            { status: 400 },
          );
        }
        if (!resolvedPayload.discipline) {
          return NextResponse.json(
            { ok: false, error: "Patient discipline is invalid" },
            { status: 400 },
          );
        }
        if (
          resolvedPayload.therapist_id
          && typeof resolvedPayload.therapist_id === "string"
          && !isUuid(resolvedPayload.therapist_id)
        ) {
          return buildInvalidLookupResponse("Therapist");
        }
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
        if (body.editingTherapistId && !isUuid(body.editingTherapistId)) {
          return buildInvalidIdentifierResponse("Therapist");
        }
        if (!normalizeRequiredText(body.payload.full_name)) {
          return NextResponse.json(
            { ok: false, error: "Therapist full name is required" },
            { status: 400 },
          );
        }
        if (!normalizeTherapistProfession(body.payload.profession)) {
          return NextResponse.json(
            { ok: false, error: "Therapist profession is invalid" },
            { status: 400 },
          );
        }

        const payload = buildTherapistServerPayload(body.payload);
        const query = body.editingTherapistId
          ? supabase
              .from("therapists")
              .update(payload)
              .eq("id", body.editingTherapistId)
              .select("*")
              .single()
          : supabase.from("therapists").insert(payload).select("*").single();

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

        if (!resolvedTherapistId || !isUuid(resolvedTherapistId)) {
          return buildInvalidLookupResponse("Therapist");
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
        const normalizedJournalStatus = normalizePatientStatus(body.patientPayload.status);

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
        }
        if (!normalizedJournalStatus) {
          return NextResponse.json(
            { ok: false, error: "Patient status is invalid" },
            { status: 400 },
          );
        }
        const resolvedJournalTherapistId = await resolveStoredTherapistId(
          typeof body.patientPayload.therapist_id === "string"
            ? body.patientPayload.therapist_id
            : null,
        );
        if (resolvedJournalTherapistId && !isUuid(resolvedJournalTherapistId)) {
          return buildInvalidLookupResponse("Therapist");
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
            status: normalizedJournalStatus,
            therapist_id: resolvedJournalTherapistId,
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
          const resolvedEntryTherapistId = await resolveStoredTherapistId(
            typeof body.journalPayload.therapist_id === "string"
              ? body.journalPayload.therapist_id
              : null,
          );
          if (resolvedEntryTherapistId && !isUuid(resolvedEntryTherapistId)) {
            return buildInvalidLookupResponse("Therapist");
          }
          const normalizedJournalPayload = {
            ...body.journalPayload,
            patient_id: resolvedPatientId,
            therapist_id: resolvedEntryTherapistId,
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
        const normalizedAmount = Number(body.amount);
        const normalizedMethod = normalizeRequiredText(body.method);
        const normalizedCategory = normalizeRequiredText(body.category);

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
        }
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
          return NextResponse.json(
            { ok: false, error: "Payment amount is invalid" },
            { status: 400 },
          );
        }
        if (!normalizedMethod) {
          return NextResponse.json(
            { ok: false, error: "Payment method is required" },
            { status: 400 },
          );
        }
        if (!normalizedCategory) {
          return NextResponse.json(
            { ok: false, error: "Payment category is required" },
            { status: 400 },
          );
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
          amount: normalizedAmount,
          method: normalizedMethod,
          status: "completed",
          category: normalizedCategory,
          note: body.note?.trim() || null,
        };
        const nextBalance =
          Number(currentBalance) - normalizedAmount;
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
        if (!isUuid(body.paymentId)) {
          return buildInvalidIdentifierResponse("Payment");
        }

        const resolvedPatientId = await resolveStoredPatientId(body.patientId);
        const normalizedAmount = Number(body.amount);
        const normalizedMethod = normalizeRequiredText(body.method);
        const normalizedCategory = normalizeRequiredText(body.category);

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
        }
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
          return NextResponse.json(
            { ok: false, error: "Payment amount is invalid" },
            { status: 400 },
          );
        }
        if (!normalizedMethod) {
          return NextResponse.json(
            { ok: false, error: "Payment method is required" },
            { status: 400 },
          );
        }
        if (!normalizedCategory) {
          return NextResponse.json(
            { ok: false, error: "Payment category is required" },
            { status: 400 },
          );
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
            { status: 404 },
          );
        }

        const nextPaymentEntry: StoredPaymentEntry = {
          ...existingPayment,
          amount: normalizedAmount,
          method: normalizedMethod,
          category: normalizedCategory,
          note: body.note?.trim() || null,
        };

        const previousAmount = Number(existingPayment.amount ?? 0);
        const nextAmount = normalizedAmount;
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
            amount: normalizedAmount,
            method: normalizedMethod,
            category: normalizedCategory,
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
        if (!isUuid(body.paymentId)) {
          return buildInvalidIdentifierResponse("Payment");
        }

        const resolvedPatientId = await resolveStoredPatientId(body.patientId);

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
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
            { status: 404 },
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
        const normalizedAppointmentDate = normalizeAppointmentDate(body.payload.appointment_at);
        const normalizedAppointmentStatus = normalizeAppointmentStatus(body.payload.status);
        const normalizedPayload = {
          ...buildAppointmentServerPayload(body.payload),
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
          appointment_at: normalizedAppointmentDate,
          status: normalizedAppointmentStatus,
        };
        if (body.editingAppointmentId && (!resolvedAppointmentId || !isUuid(resolvedAppointmentId))) {
          return buildInvalidLookupResponse("Appointment");
        }
        if (
          !normalizedPayload.patient_id
          || typeof normalizedPayload.patient_id !== "string"
          || !isUuid(normalizedPayload.patient_id)
        ) {
          return buildInvalidLookupResponse("Patient");
        }
        if (!normalizedPayload.appointment_at) {
          return NextResponse.json(
            { ok: false, error: "Appointment date is invalid" },
            { status: 400 },
          );
        }
        if (!normalizedPayload.status) {
          return NextResponse.json(
            { ok: false, error: "Appointment status is invalid" },
            { status: 400 },
          );
        }
        if (
          normalizedPayload.therapist_id
          && typeof normalizedPayload.therapist_id === "string"
          && !isUuid(normalizedPayload.therapist_id)
        ) {
          return buildInvalidLookupResponse("Therapist");
        }
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
        const normalizedStatus = normalizePatientStatus(body.status);

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
        }

        if (!normalizedStatus) {
          return NextResponse.json(
            { ok: false, error: "Patient status is invalid" },
            { status: 400 },
          );
        }

        const { data, error } = await supabase
          .from("patients")
          .update({ status: normalizedStatus })
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

        if (!resolvedAppointmentId || !isUuid(resolvedAppointmentId)) {
          return buildInvalidLookupResponse("Appointment");
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

        if (!resolvedPatientId || !isUuid(resolvedPatientId)) {
          return buildInvalidLookupResponse("Patient");
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
