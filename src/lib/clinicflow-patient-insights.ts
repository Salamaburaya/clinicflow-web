type InsightTone = "critical" | "warn" | "info";

type PatientLike = {
  id: string;
  full_name: string;
  status: string;
  phone?: string | null;
  email?: string | null;
  therapist_id?: string | null;
  treatment_goal?: string | null;
  attendance_risk?: string | null;
  payment_balance?: number | null;
};

type AppointmentLike = {
  patient_id: string;
  appointment_at: string;
};

type JournalEntryLike = {
  patient_id: string;
  entry_date: string;
};

export type PatientOperationalFlag = {
  key: string;
  label: string;
  detail: string;
  action: string;
  tone: InsightTone;
  priority: number;
};

export type OperationalQueueItem = {
  patientId: string;
  patientName: string;
  reason: string;
  action: string;
};

export type OperationalQueue = {
  key: string;
  title: string;
  description: string;
  tone: InsightTone;
  count: number;
  items: OperationalQueueItem[];
};

function getTime(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function formatCurrency(value: number) {
  return `${Math.abs(value)} ש״ח`;
}

function isAttendanceRiskElevated(value?: string | null) {
  if (!value) {
    return false;
  }

  return value.includes("גבוה") || value.includes("בינוני");
}

export function getPatientOperationalFlags(
  patient: PatientLike,
  appointments: AppointmentLike[],
  journalEntries: JournalEntryLike[],
) {
  const now = Date.now();
  const futureAppointments = appointments
    .filter((appointment) => getTime(appointment.appointment_at) > now)
    .sort((left, right) => getTime(left.appointment_at) - getTime(right.appointment_at));
  const latestEntry = journalEntries
    .slice()
    .sort((left, right) => getTime(right.entry_date) - getTime(left.entry_date))[0];
  const latestEntryAgeDays = latestEntry
    ? Math.floor((now - getTime(latestEntry.entry_date)) / (1000 * 60 * 60 * 24))
    : null;

  const flags: PatientOperationalFlag[] = [];

  if (!patient.therapist_id) {
    flags.push({
      key: "no-therapist",
      label: "ללא מטפל אחראי",
      detail: "המטופל אינו משויך לאיש צוות קבוע.",
      action: "לשייך מטפל אחראי",
      tone: "critical",
      priority: 100,
    });
  }

  if (!patient.phone && !patient.email) {
    flags.push({
      key: "missing-contact",
      label: "חסרים פרטי קשר",
      detail: "לא הוזן טלפון או דוא״ל ליצירת קשר.",
      action: "להשלים טלפון או דוא״ל",
      tone: "critical",
      priority: 95,
    });
  }

  if (patient.payment_balance && patient.payment_balance > 0) {
    flags.push({
      key: "open-balance",
      label: `חוב פתוח ${formatCurrency(patient.payment_balance)}`,
      detail: "קיימת יתרת חוב שדורשת מעקב גבייה.",
      action: "לעדכן תשלום או חיוב",
      tone: "critical",
      priority: 92,
    });
  }

  if ((patient.status === "חדש" || patient.status === "בטיפול") && futureAppointments.length === 0) {
    flags.push({
      key: "no-future-appointment",
      label: "ללא תור עתידי",
      detail: "אין פגישה עתידית מתוכננת במערכת.",
      action: "לקבוע מפגש המשך",
      tone: "warn",
      priority: 80,
    });
  }

  if (
    patient.status === "בטיפול"
    && (!latestEntry || (latestEntryAgeDays !== null && latestEntryAgeDays > 21))
  ) {
    flags.push({
      key: "stale-notes",
      label: latestEntry ? "תיעוד לא עודכן" : "אין תיעוד קליני",
      detail: latestEntry
        ? `לא נוספה רשומה חדשה כבר ${latestEntryAgeDays} ימים.`
        : "לא קיימת עדיין רשומת תיעוד בתיק.",
      action: "לעדכן יומן טיפולי",
      tone: "warn",
      priority: 76,
    });
  }

  if (!patient.treatment_goal) {
    flags.push({
      key: "missing-goal",
      label: "יעד טיפולי חסר",
      detail: "התיק עדיין ללא יעד טיפולי מוגדר.",
      action: "להשלים יעד טיפולי",
      tone: "info",
      priority: 58,
    });
  }

  if (isAttendanceRiskElevated(patient.attendance_risk)) {
    flags.push({
      key: "attendance-risk",
      label: `סיכון נשירה ${patient.attendance_risk}`,
      detail: "כדאי לעקוב אחרי רציפות טיפול והגעה.",
      action: "לבצע מעקב יזום",
      tone: "info",
      priority: 52,
    });
  }

  return flags.sort((left, right) => right.priority - left.priority);
}

export function getOperationalQueues(
  patients: PatientLike[],
  appointments: AppointmentLike[],
  journalEntries: JournalEntryLike[],
) {
  const queues = {
    scheduling: [] as OperationalQueueItem[],
    documentation: [] as OperationalQueueItem[],
    finance: [] as OperationalQueueItem[],
    profile: [] as OperationalQueueItem[],
  };

  patients.forEach((patient) => {
    const flags = getPatientOperationalFlags(
      patient,
      appointments.filter((appointment) => appointment.patient_id === patient.id),
      journalEntries.filter((entry) => entry.patient_id === patient.id),
    );

    flags.forEach((flag) => {
      const item = {
        patientId: patient.id,
        patientName: patient.full_name,
        reason: flag.label,
        action: flag.action,
      };

      if (flag.key === "no-future-appointment") {
        queues.scheduling.push(item);
      } else if (flag.key === "stale-notes") {
        queues.documentation.push(item);
      } else if (flag.key === "open-balance") {
        queues.finance.push(item);
      } else if (flag.key === "missing-contact" || flag.key === "no-therapist" || flag.key === "missing-goal") {
        queues.profile.push(item);
      }
    });
  });

  return [
    {
      key: "scheduling",
      title: "תיאומים להמשך",
      description: "מטופלים שדורשים קביעת מפגש נוסף",
      tone: "warn" as const,
      count: queues.scheduling.length,
      items: queues.scheduling.slice(0, 4),
    },
    {
      key: "documentation",
      title: "תיעוד לעדכון",
      description: "תיקים שחסר בהם תיעוד קליני עדכני",
      tone: "info" as const,
      count: queues.documentation.length,
      items: queues.documentation.slice(0, 4),
    },
    {
      key: "finance",
      title: "מעקב גבייה",
      description: "מטופלים עם חוב פתוח",
      tone: "critical" as const,
      count: queues.finance.length,
      items: queues.finance.slice(0, 4),
    },
    {
      key: "profile",
      title: "תיקים להשלמה",
      description: "פרטי קשר, שיוך או יעד טיפולי שחסרים",
      tone: "warn" as const,
      count: queues.profile.length,
      items: queues.profile.slice(0, 4),
    },
  ] satisfies OperationalQueue[];
}
