import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MutationRequest;
    const supabase = getServerSupabaseClient();

    switch (body.action) {
      case "savePatient": {
        const query = body.editingPatientId
          ? supabase
              .from("patients")
              .update(body.payload)
              .eq("id", body.editingPatientId)
              .select("*")
              .single()
          : supabase.from("patients").insert(body.payload).select("*").single();

        const { data, error } = await query;

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Patient save failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, patient: data });
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
        const detachResult = await supabase
          .from("patients")
          .update({ therapist_id: null })
          .eq("therapist_id", body.therapistId);

        if (detachResult.error) {
          return NextResponse.json(
            { ok: false, error: detachResult.error.message },
            { status: 500 },
          );
        }

        const { error } = await supabase
          .from("therapists")
          .delete()
          .eq("id", body.therapistId);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
      }

      case "saveJournal": {
        const patientResult = await supabase
          .from("patients")
          .update(body.patientPayload)
          .eq("id", body.patientId)
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
          const journalResult = await supabase
            .from("journal_entries")
            .insert(body.journalPayload)
            .select("*")
            .single();

          if (journalResult.error || !journalResult.data) {
            return NextResponse.json(
              {
                ok: false,
                error: journalResult.error?.message ?? "Journal save failed",
                patient: patientResult.data,
              },
              { status: 500 },
            );
          }

          journalEntry = journalResult.data;
        }

        return NextResponse.json({
          ok: true,
          patient: patientResult.data,
          journalEntry,
        });
      }

      case "savePayment": {
        const patientResult = await supabase
          .from("patients")
          .select("*")
          .eq("id", body.patientId)
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

        const paymentResult = await supabase
          .from("payment_entries")
          .insert({
            patient_id: body.patientId,
            amount: body.amount,
            method: body.method,
            status: "completed",
            category: body.category,
            note: body.note?.trim() || null,
          })
          .select("*")
          .single();

        if (paymentResult.error || !paymentResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: paymentResult.error?.message ?? "Payment save failed",
            },
            { status: 500 },
          );
        }

        const nextBalance =
          Number(patientResult.data.payment_balance ?? 0) - Number(body.amount);
        const patientUpdateResult = await supabase
          .from("patients")
          .update({ payment_balance: nextBalance })
          .eq("id", body.patientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          await supabase.from("payment_entries").delete().eq("id", paymentResult.data.id);

          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Patient balance update failed",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          ok: true,
          paymentEntry: paymentResult.data,
          patient: patientUpdateResult.data,
        });
      }

      case "updatePayment": {
        const [patientResult, paymentLookupResult] = await Promise.all([
          supabase.from("patients").select("*").eq("id", body.patientId).single(),
          supabase.from("payment_entries").select("*").eq("id", body.paymentId).single(),
        ]);

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        if (paymentLookupResult.error || !paymentLookupResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: paymentLookupResult.error?.message ?? "Payment lookup failed",
            },
            { status: 500 },
          );
        }

        const paymentUpdateResult = await supabase
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

        if (paymentUpdateResult.error || !paymentUpdateResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: paymentUpdateResult.error?.message ?? "Payment update failed",
            },
            { status: 500 },
          );
        }

        const previousAmount = Number(paymentLookupResult.data.amount ?? 0);
        const nextAmount = Number(body.amount);
        const nextBalance =
          Number(patientResult.data.payment_balance ?? 0) - (nextAmount - previousAmount);

        const patientUpdateResult = await supabase
          .from("patients")
          .update({ payment_balance: nextBalance })
          .eq("id", body.patientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          await supabase
            .from("payment_entries")
            .update({
              amount: paymentLookupResult.data.amount,
              method: paymentLookupResult.data.method,
              category: paymentLookupResult.data.category,
              note: paymentLookupResult.data.note,
            })
            .eq("id", body.paymentId);

          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Patient balance update failed",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          ok: true,
          paymentEntry: paymentUpdateResult.data,
          patient: patientUpdateResult.data,
        });
      }

      case "deletePayment": {
        const [patientResult, paymentLookupResult] = await Promise.all([
          supabase.from("patients").select("*").eq("id", body.patientId).single(),
          supabase.from("payment_entries").select("*").eq("id", body.paymentId).single(),
        ]);

        if (patientResult.error || !patientResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: patientResult.error?.message ?? "Patient lookup failed",
            },
            { status: 500 },
          );
        }

        if (paymentLookupResult.error || !paymentLookupResult.data) {
          return NextResponse.json(
            {
              ok: false,
              error: paymentLookupResult.error?.message ?? "Payment lookup failed",
            },
            { status: 500 },
          );
        }

        const deleteResult = await supabase
          .from("payment_entries")
          .delete()
          .eq("id", body.paymentId);

        if (deleteResult.error) {
          return NextResponse.json(
            {
              ok: false,
              error: deleteResult.error.message,
            },
            { status: 500 },
          );
        }

        const nextBalance =
          Number(patientResult.data.payment_balance ?? 0) +
          Number(paymentLookupResult.data.amount ?? 0);
        const patientUpdateResult = await supabase
          .from("patients")
          .update({ payment_balance: nextBalance })
          .eq("id", body.patientId)
          .select("*")
          .single();

        if (patientUpdateResult.error || !patientUpdateResult.data) {
          await supabase.from("payment_entries").insert({
            patient_id: paymentLookupResult.data.patient_id,
            amount: paymentLookupResult.data.amount,
            method: paymentLookupResult.data.method,
            status: paymentLookupResult.data.status,
            category: paymentLookupResult.data.category,
            note: paymentLookupResult.data.note,
          });

          return NextResponse.json(
            {
              ok: false,
              error: patientUpdateResult.error?.message ?? "Patient balance update failed",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          ok: true,
          patient: patientUpdateResult.data,
        });
      }

      case "saveAppointment": {
        const query = body.editingAppointmentId
          ? supabase
              .from("appointments")
              .update(body.payload)
              .eq("id", body.editingAppointmentId)
              .select("*")
              .single()
          : supabase.from("appointments").insert(body.payload).select("*").single();

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
        const { data, error } = await supabase
          .from("patients")
          .update({ status: body.status })
          .eq("id", body.patientId)
          .select("*")
          .single();

        if (error || !data) {
          return NextResponse.json(
            { ok: false, error: error?.message ?? "Status update failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({ ok: true, patient: data });
      }

      case "deleteAppointment": {
        const { error } = await supabase
          .from("appointments")
          .delete()
          .eq("id", body.appointmentId);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
      }

      case "deletePatient": {
        const journalDeleteResult = await supabase
          .from("journal_entries")
          .delete()
          .eq("patient_id", body.patientId);

        if (journalDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: journalDeleteResult.error.message },
            { status: 500 },
          );
        }

        const appointmentDeleteResult = await supabase
          .from("appointments")
          .delete()
          .eq("patient_id", body.patientId);

        if (appointmentDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: appointmentDeleteResult.error.message },
            { status: 500 },
          );
        }

        const paymentDeleteResult = await supabase
          .from("payment_entries")
          .delete()
          .eq("patient_id", body.patientId);

        if (paymentDeleteResult.error) {
          return NextResponse.json(
            { ok: false, error: paymentDeleteResult.error.message },
            { status: 500 },
          );
        }

        const patientDeleteResult = await supabase
          .from("patients")
          .delete()
          .eq("id", body.patientId);

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
