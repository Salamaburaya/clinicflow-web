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
