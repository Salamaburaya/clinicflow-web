import { toWhatsAppAddress } from "@/lib/phone";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export type ReminderKind = "confirmation" | "24h" | "1h";
export type ReminderAudience = "patient" | "therapist";

type AppointmentRow = {
  id: string;
  appointment_at: string;
  patient_id: string;
  therapist_id: string | null;
};

type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
};

type TherapistRow = {
  id: string;
  full_name: string;
  phone: string | null;
};

type NoticePayload = {
  body: string;
  phone: string;
  sentAtColumn: string;
  templateSid: string;
  templateVariables: string;
};

type SendNoticeResult = {
  audience: ReminderAudience;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

function formatAppointmentTime(value: string) {
  return new Date(value).toLocaleString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

function formatAppointmentDate(value: string) {
  return new Date(value).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
}

function getSentAtColumn(kind: ReminderKind, audience: ReminderAudience) {
  if (kind === "confirmation") {
    return audience === "patient"
      ? "patient_confirmation_sent_at"
      : "therapist_confirmation_sent_at";
  }

  if (kind === "24h") {
    return audience === "patient"
      ? "patient_reminder_24h_sent_at"
      : "therapist_reminder_24h_sent_at";
  }

  return audience === "patient"
    ? "patient_reminder_1h_sent_at"
    : "therapist_reminder_1h_sent_at";
}

function getNoticeText(
  kind: ReminderKind,
  audience: ReminderAudience,
  patientName: string,
  therapistName: string,
  appointmentAt: string,
) {
  const dateText = formatAppointmentDate(appointmentAt);
  const timeText = formatAppointmentTime(appointmentAt);

  if (kind === "confirmation") {
    if (audience === "patient") {
      return `שלום ${patientName}, נקבע עבורך טיפול בתאריך ${dateText} בשעה ${timeText}. המטפל/ת: ${therapistName}.`;
    }

    return `נקבע טיפול עבור ${patientName} בתאריך ${dateText} בשעה ${timeText}.`;
  }

  if (kind === "24h") {
    if (audience === "patient") {
      return `תזכורת: מחר יש לך טיפול בתאריך ${dateText} בשעה ${timeText}. המטפל/ת: ${therapistName}.`;
    }

    return `תזכורת: בעוד כ-24 שעות יש טיפול ל-${patientName} בתאריך ${dateText} בשעה ${timeText}.`;
  }

  if (audience === "patient") {
    return `תזכורת: בעוד כשעה יש לך טיפול בשעה ${timeText}. המטפל/ת: ${therapistName}.`;
  }

  return `תזכורת: בעוד כשעה יש טיפול ל-${patientName} בשעה ${timeText}.`;
}

function getTemplateSid(kind: ReminderKind, audience: ReminderAudience) {
  const key =
    kind === "confirmation"
      ? audience === "patient"
        ? "TWILIO_TEMPLATE_CONFIRMATION_PATIENT"
        : "TWILIO_TEMPLATE_CONFIRMATION_THERAPIST"
      : kind === "24h"
        ? audience === "patient"
          ? "TWILIO_TEMPLATE_REMINDER_24H_PATIENT"
          : "TWILIO_TEMPLATE_REMINDER_24H_THERAPIST"
        : audience === "patient"
          ? "TWILIO_TEMPLATE_REMINDER_1H_PATIENT"
          : "TWILIO_TEMPLATE_REMINDER_1H_THERAPIST";

  return process.env[key] ?? "";
}

async function sendTwilioWhatsApp(payload: {
  phone: string;
  body: string;
  templateSid?: string;
  templateVariables?: string;
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio WhatsApp environment variables");
  }

  const requestBody = new URLSearchParams({
    From: from,
    To: toWhatsAppAddress(payload.phone),
  });

  if (payload.templateSid) {
    requestBody.set("ContentSid", payload.templateSid);
    if (payload.templateVariables) {
      requestBody.set("ContentVariables", payload.templateVariables);
    }
  } else {
    requestBody.set("Body", payload.body);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Twilio request failed");
  }

  return response.json();
}

async function loadAppointmentBundle(appointmentId: string) {
  const supabase = getServerSupabaseClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    throw new Error("Appointment not found");
  }

  const [patientResult, therapistResult] = await Promise.all([
    supabase.from("patients").select("id, full_name, phone").eq("id", appointment.patient_id).single(),
    appointment.therapist_id
      ? supabase
          .from("therapists")
          .select("id, full_name, phone")
          .eq("id", appointment.therapist_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (patientResult.error || !patientResult.data) {
    throw new Error("Patient not found");
  }

  return {
    supabase,
    appointment: appointment as AppointmentRow & Record<string, string | null>,
    patient: patientResult.data as PatientRow,
    therapist: therapistResult.data as TherapistRow | null,
  };
}

export async function sendAppointmentNotices(
  appointmentId: string,
  kind: ReminderKind,
  audiences: ReminderAudience[],
) {
  const { supabase, appointment, patient, therapist } =
    await loadAppointmentBundle(appointmentId);

  const therapistName = therapist?.full_name ?? "המטפל/ת";
  const uniqueAudiences = Array.from(new Set(audiences));
  const results: SendNoticeResult[] = [];

  for (const audience of uniqueAudiences) {
    const sentAtColumn = getSentAtColumn(kind, audience);
    if (appointment[sentAtColumn]) {
      results.push({ audience, ok: true, skipped: true, reason: "already_sent" });
      continue;
    }

    const phone = audience === "patient" ? patient.phone ?? "" : therapist?.phone ?? "";
    if (!phone) {
      results.push({ audience, ok: false, skipped: true, reason: "missing_phone" });
      continue;
    }

    const payload: NoticePayload = {
      body: getNoticeText(
        kind,
        audience,
        patient.full_name,
        therapistName,
        appointment.appointment_at,
      ),
      phone,
      sentAtColumn,
      templateSid: getTemplateSid(kind, audience),
      templateVariables: JSON.stringify({
        "1": patient.full_name,
        "2": formatAppointmentDate(appointment.appointment_at),
        "3": formatAppointmentTime(appointment.appointment_at),
        "4": therapistName,
      }),
    };

    await sendTwilioWhatsApp({
      phone: payload.phone,
      body: payload.body,
      templateSid: payload.templateSid || undefined,
      templateVariables: payload.templateVariables,
    });

    const { error } = await supabase
      .from("appointments")
      .update({ [payload.sentAtColumn]: new Date().toISOString() })
      .eq("id", appointment.id);

    if (error) {
      throw new Error(`Failed to update ${payload.sentAtColumn}`);
    }

    results.push({ audience, ok: true });
  }

  return results;
}

export async function runScheduledReminderSweep() {
  const supabase = getServerSupabaseClient();
  const now = Date.now();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("status", "scheduled")
    .gte("appointment_at", new Date(now).toISOString())
    .lte("appointment_at", new Date(now + 24 * 60 * 60 * 1000).toISOString())
    .order("appointment_at", { ascending: true });

  if (error) {
    throw new Error("Failed to load appointments for reminders");
  }

  const summary = {
    checked: appointments?.length ?? 0,
    sent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const appointment of (appointments ?? []) as (AppointmentRow &
    Record<string, string | null>)[]) {
    const diffMs = new Date(appointment.appointment_at).getTime() - now;
    const kinds: ReminderKind[] = [];

    if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
      kinds.push("24h");
    }
    if (diffMs > 0 && diffMs <= 60 * 60 * 1000) {
      kinds.push("1h");
    }

    for (const kind of kinds) {
      try {
        const results = await sendAppointmentNotices(appointment.id, kind, [
          "patient",
          "therapist",
        ]);
        summary.sent += results.filter((result) => result.ok && !result.skipped).length;
        summary.skipped += results.filter((result) => result.skipped).length;
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unknown reminder error";
        summary.errors.push(`${appointment.id}:${kind}:${message}`);
      }
    }
  }

  return summary;
}
