type AppointmentStatusTone = "warm" | "good" | "critical" | "info";

const appointmentStatusLabels: Record<string, string> = {
  scheduled: "נקבע",
  confirmed: "נקבע",
  completed: "הושלם",
  done: "הושלם",
  cancelled: "בוטל",
  canceled: "בוטל",
  no_show: "לא הגיע",
  "no-show": "לא הגיע",
  noshow: "לא הגיע",
  "נקבע": "נקבע",
  "הושלם": "הושלם",
  "בוטל": "בוטל",
  "לא הגיע": "לא הגיע",
};

const appointmentStatusTones: Record<string, AppointmentStatusTone> = {
  scheduled: "warm",
  confirmed: "warm",
  completed: "good",
  done: "good",
  cancelled: "critical",
  canceled: "critical",
  no_show: "info",
  "no-show": "info",
  noshow: "info",
  "נקבע": "warm",
  "הושלם": "good",
  "בוטל": "critical",
  "לא הגיע": "info",
};

function normalizeStatus(status?: string | null) {
  return status?.trim().toLowerCase() ?? "";
}

export function getAppointmentStatusLabel(status?: string | null) {
  if (!status) {
    return "לא הוגדר";
  }

  return appointmentStatusLabels[normalizeStatus(status)] ?? status;
}

export function getAppointmentStatusTone(status?: string | null): AppointmentStatusTone {
  return appointmentStatusTones[normalizeStatus(status)] ?? "info";
}
