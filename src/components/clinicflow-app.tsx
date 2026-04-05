"use client";

import {
  type AccessContext,
  type AppRole,
  type AppSection,
  canEditClinicalNotes,
  canManageAppointments,
  canManagePatients,
  getRoleLabel,
  getVisibleSections,
} from "@/lib/clinicflow-access";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { PatientProfileWorkspace } from "@/components/patient-profile-workspace";
import { getSupabaseClient } from "@/lib/supabase";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

type Therapist = {
  id: string;
  full_name: string;
  profession: string;
  specialty: string | null;
  phone?: string | null;
};

type Patient = {
  id: string;
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string | null;
  treatment_goal: string | null;
  therapist_id: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  occupation?: string | null;
  referring_source?: string | null;
  intake_summary?: string | null;
  medical_background?: string | null;
  medications?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  insurance_provider?: string | null;
  coverage_track?: string | null;
  communication_preference?: string | null;
  preferred_days?: string | null;
  attendance_risk?: string | null;
  functional_status?: string | null;
  payment_balance?: number | null;
};

type Appointment = {
  id: string;
  room: string | null;
  status: string;
  summary: string | null;
  appointment_at: string;
  patient_id: string;
  therapist_id: string | null;
};

type JournalEntry = {
  id: string;
  patient_id: string;
  therapist_id: string | null;
  entry_date: string;
  content: string;
  home_program: string | null;
  created_at: string;
};

type ClinicFlowAppProps = {
  therapists: Therapist[];
  initialPatients: Patient[];
  appointments: Appointment[];
  accessContext: AccessContext;
};

type AddPatientForm = {
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string;
  treatment_goal: string;
  phone: string;
};

type JournalForm = {
  status: string;
  diagnosis: string;
  goal: string;
  templateKey: string;
  templateAnswers: Record<string, string>;
  latestNote: string;
  homeProgram: string;
  phone: string;
};

type AppointmentForm = {
  patient_id: string;
  therapist_id: string;
  appointment_day: string;
  appointment_month: string;
  appointment_year: string;
  appointment_hour: string;
  appointment_minute: string;
  room: string;
  summary: string;
};

type AddTherapistForm = {
  full_name: string;
  profession: string;
  specialty: string;
  phone: string;
};

type ReminderKind = "confirmation" | "24h" | "1h";

type ReminderNotice = {
  id: string;
  appointmentId: string;
  kind: ReminderKind;
  audience: "therapist" | "patient";
  title: string;
  message: string;
  createdAt: string;
  phone?: string | null;
  sentAt?: string | null;
};

type DemoTherapistSeed = {
  full_name: string;
  profession: string;
  specialty: string;
  phone: string;
};

type DemoPatientSeed = {
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string;
  treatment_goal: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  birth_date: string;
  gender: string;
  occupation: string;
  referring_source: string;
  intake_summary: string;
  medical_background: string;
  medications: string;
  allergies: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  insurance_provider: string;
  coverage_track: string;
  communication_preference: string;
  preferred_days: string;
  attendance_risk: string;
  functional_status: string;
  payment_balance: number;
  therapistName: string;
  appointments: Array<{
    daysOffset: number;
    hour: number;
    minute: number;
    room: string;
    summary: string;
    status?: string;
  }>;
  journalEntries: Array<{
    daysOffset: number;
    content: string;
    homeProgram?: string;
  }>;
};

type JournalTemplateField = {
  key: string;
  label: string;
  placeholder: string;
  suggestions?: string[];
};

type JournalTemplate = {
  key: string;
  label: string;
  description: string;
  disciplines: string[];
  sections: JournalTemplateField[];
};

const defaultAddPatientForm: AddPatientForm = {
  full_name: "",
  discipline: "פיזיותרפיה",
  status: "חדש",
  diagnosis: "",
  treatment_goal: "",
  phone: "",
};

const defaultJournalForm: JournalForm = {
  status: "חדש",
  diagnosis: "",
  goal: "",
  templateKey: "followup",
  templateAnswers: {},
  latestNote: "",
  homeProgram: "",
  phone: "",
};

const journalTemplates: JournalTemplate[] = [
  {
    key: "intake",
    label: "אינטייק והערכה ראשונית",
    description: "פתיחת תהליך, מיפוי מצב פתיחה והגדרת כיוון טיפולי.",
    disciplines: ["פיזיותרפיה", "ריפוי בעיסוק"],
    sections: [
      {
        key: "reason",
        label: "סיבת פניה",
        placeholder: "תיאור הקושי המרכזי או הסיבה שבגללה המטופל הגיע",
        suggestions: ["כאב מתמשך", "קושי תפקודי", "הערכה ראשונית"],
      },
      {
        key: "baseline",
        label: "מצב פתיחה",
        placeholder: "מה מצב המטופל כרגע מבחינת תפקוד, כאב, ויסות או עצמאות",
        suggestions: ["כאב במאמץ", "קושי בהתארגנות", "סבולת נמוכה"],
      },
      {
        key: "plan",
        label: "תוכנית התחלה",
        placeholder: "מה הוגדר להתחלה, מה תדירות הטיפול ומה מטרת השלב הראשון",
        suggestions: ["בניית שגרה טיפולית", "הדרכת בית", "הפחתת כאב"],
      },
    ],
  },
  {
    key: "followup",
    label: "מעקב שוטף",
    description: "בדיקת התקדמות, מה נעשה במפגש, ומה ההחלטה להמשך.",
    disciplines: ["פיזיותרפיה", "ריפוי בעיסוק"],
    sections: [
      {
        key: "progress",
        label: "התקדמות",
        placeholder: "מה השתפר, מה נתקע, ואיך עבר הזמן מאז המפגש הקודם",
        suggestions: ["שיפור חלקי", "עמידה טובה בתרגול", "קושי בהתמדה"],
      },
      {
        key: "session",
        label: "מה נעשה במפגש",
        placeholder: "התערבויות, תרגול, התאמות או הדרכה שבוצעו במפגש",
        suggestions: ["תרגול הדרגתי", "הדרכת הורה", "התאמת סביבה"],
      },
      {
        key: "next_step",
        label: "החלטה להמשך",
        placeholder: "מה ממשיכים, מה משנים, ועל מה חשוב לעקוב עד הפגישה הבאה",
        suggestions: ["להמשיך באותה תוכנית", "להעלות עומס", "מעקב בעוד שבוע"],
      },
    ],
  },
  {
    key: "discharge",
    label: "סיכום והמלצות",
    description: "סיכום תהליך, מצב נוכחי והמלצות לשלב הבא.",
    disciplines: ["פיזיותרפיה", "ריפוי בעיסוק"],
    sections: [
      {
        key: "summary",
        label: "סיכום התהליך",
        placeholder: "תיאור קצר של עיקר התהליך וההתקדמות המצטברת",
        suggestions: ["עמידה ביעדים", "שיפור תפקודי משמעותי", "נדרש מעקב נוסף"],
      },
      {
        key: "status_now",
        label: "מצב נוכחי",
        placeholder: "מה מצב המטופל נכון לעכשיו",
        suggestions: ["עצמאות טובה יותר", "כאב קל בלבד", "תפקוד יציב יותר"],
      },
      {
        key: "recommendations",
        label: "המלצות להמשך",
        placeholder: "תרגול, מעקב, המלצות או נקודות חשובות להמשך",
        suggestions: ["המשך תרגול עצמי", "מעקב לפי צורך", "פניה חוזרת בהחמרה"],
      },
    ],
  },
];

const demoTherapists: DemoTherapistSeed[] = [
  {
    full_name: "חן תאסיריה",
    profession: "פיזיותרפיה",
    specialty: "שיקום אורתופדי וספורט",
    phone: "0501112233",
  },
  {
    full_name: "מאיה לוי",
    profession: "ריפוי בעיסוק",
    specialty: "ויסות חושי ותפקוד יומיומי",
    phone: "0502223344",
  },
  {
    full_name: "עמית כהן",
    profession: "פיזיותרפיה",
    specialty: "שיקום נוירולוגי ומעקב תפקודי",
    phone: "0503334455",
  },
];

const demoPatients: DemoPatientSeed[] = [
  {
    full_name: "דמו נועה אלקיים",
    discipline: "פיזיותרפיה",
    status: "בטיפול",
    diagnosis: "כאבי ברך לאחר עומס מתמשך",
    treatment_goal: "חזרה לפעילות מלאה והפחתת כאב במדרגות",
    phone: "0504445566",
    email: "noa.demo@example.com",
    city: "חיפה",
    address: "רחוב הגפן 18",
    birth_date: "1996-07-14",
    gender: "אישה",
    occupation: "מאמנת כושר",
    referring_source: "הפניה מאורתופד ספורט",
    intake_summary:
      "הגיעה בעקבות כאב בברך ימין שמתגבר באימוני כוח, עלייה במדרגות וריצה קצרה. מוטיבציה גבוהה לחזור לאימונים מלאים.",
    medical_background:
      "ללא ניתוחים קודמים. היסטוריה של עומס חוזר סביב הפיקה בתקופות אימון אינטנסיביות.",
    medications: "נוטלת משכך כאב לפי צורך בלבד",
    allergies: "ללא רגישויות ידועות",
    emergency_contact_name: "אלון אלקיים",
    emergency_contact_phone: "0507001100",
    insurance_provider: "הפניקס",
    coverage_track: "פרטי + החזר משלים",
    communication_preference: "וואטסאפ",
    preferred_days: "ראשון, רביעי",
    attendance_risk: "נמוך",
    functional_status: "מסוגלת לעבוד, אך מגבילה קפיצות, כריעה וריצה ממושכת.",
    payment_balance: -180,
    therapistName: "חן תאסיריה",
    appointments: [
      {
        daysOffset: -12,
        hour: 10,
        minute: 0,
        room: "חדר 2",
        summary: "הערכה ראשונית ותוכנית עבודה",
      },
      {
        daysOffset: -5,
        hour: 11,
        minute: 30,
        room: "חדר 2",
        summary: "תרגול הדרגתי ושיפור שליטה",
      },
      {
        daysOffset: 3,
        hour: 9,
        minute: 0,
        room: "חדר 1",
        summary: "מעקב תפקודי והתקדמות לעומסים",
      },
    ],
    journalEntries: [
      {
        daysOffset: -12,
        content: "תבנית: אינטייק והערכה ראשונית\nסיבת פניה: כאב בברך ימין לאחר עומס באימונים\nמצב פתיחה: קושי בעלייה במדרגות ובכריעה\nתוכנית התחלה: חיזוק הדרגתי, הפחתת עומס והדרכת בית",
        homeProgram: "תרגילי חיזוק ירך קדמית 3 פעמים בשבוע",
      },
      {
        daysOffset: -5,
        content: "תבנית: מעקב שוטף\nהתקדמות: ירידה בעוצמת הכאב במנוחה\nמה נעשה במפגש: תרגול יציבה, שליטה ותבניות תנועה\nהחלטה להמשך: המשך עבודה הדרגתית והגדלת טווח",
        homeProgram: "תרגול מדרגה נמוכה וסקוואט חלקי",
      },
    ],
  },
  {
    full_name: "דמו אורי בן דוד",
    discipline: "ריפוי בעיסוק",
    status: "מעקב",
    diagnosis: "קושי בהתארגנות בוקר וויסות",
    treatment_goal: "שיפור עצמאות ברוטינת בוקר והפחתת הצפה חושית",
    phone: "0505556677",
    email: "uri.demo@example.com",
    city: "קרית מוצקין",
    address: "רחוב הדקל 7",
    birth_date: "2016-11-03",
    gender: "בן",
    occupation: "תלמיד כיתה ד'",
    referring_source: "הפניה מיועצת בית הספר",
    intake_summary:
      "הפניה עקב קושי בהתארגנות, מעברים ועומס חושי בשעות הבוקר. ההורים מדווחים על שחיקה גבוהה סביב היציאה למסגרת.",
    medical_background:
      "אבחון קודם של קשיי ויסות. ללא אשפוזים או רקע נוירולוגי משמעותי.",
    medications: "ללא טיפול תרופתי קבוע",
    allergies: "רגישות קלה לאבק",
    emergency_contact_name: "שירי בן דוד",
    emergency_contact_phone: "0526002200",
    insurance_provider: "מכבי שלי",
    coverage_track: "התחייבות קופה",
    communication_preference: "טלפון להורה",
    preferred_days: "שני, חמישי",
    attendance_risk: "בינוני",
    functional_status: "זקוק לתיווך במעברים, התארגנות עצמית חלקית בלבד בשעות הלחץ.",
    payment_balance: 0,
    therapistName: "מאיה לוי",
    appointments: [
      {
        daysOffset: -20,
        hour: 14,
        minute: 0,
        room: "חדר 3",
        summary: "אינטייק עם הורה ומיפוי מטרות",
      },
      {
        daysOffset: -7,
        hour: 15,
        minute: 15,
        room: "חדר 3",
        summary: "עבודה על רצף בוקר וכלים חושיים",
      },
      {
        daysOffset: 6,
        hour: 13,
        minute: 45,
        room: "חדר 4",
        summary: "מעקב תפקודי והטמעת אסטרטגיות",
      },
    ],
    journalEntries: [
      {
        daysOffset: -20,
        content: "תבנית: אינטייק והערכה ראשונית\nסיבת פניה: קושי במעברים והתארגנות בבוקר\nמצב פתיחה: צורך בתיווך גבוה מצד ההורה\nתוכנית התחלה: בניית רצף קבוע, עזרים חזותיים והדרכה להורים",
        homeProgram: "לוח חזותי לבוקר ונקודת בקרה אחת קבועה",
      },
    ],
  },
  {
    full_name: "דמו רועי פרץ",
    discipline: "פיזיותרפיה",
    status: "חדש",
    diagnosis: "כאבי גב תחתון לאחר ישיבה ממושכת",
    treatment_goal: "הפחתת כאב ושיפור סבולת לישיבה ולעבודה",
    phone: "0506667788",
    email: "roee.demo@example.com",
    city: "עכו",
    address: "רחוב הכלנית 3",
    birth_date: "1988-02-27",
    gender: "גבר",
    occupation: "מפתח תוכנה",
    referring_source: "הגעה עצמאית דרך אתר הקליניקה",
    intake_summary:
      "מדווח על כאב גב תחתון שמתגבר לאחר ישיבה ממושכת ועבודה מול מחשב. מחפש פתרון פרקטי לשילוב ביום עבודה.",
    medical_background:
      "פריצת דיסק ישנה ללא ניתוח. עשה פיזיותרפיה לפני שלוש שנים עם שיפור חלקי.",
    medications: "אטופן לפי צורך פעם-פעמיים בשבוע",
    allergies: "ללא רגישויות ידועות",
    emergency_contact_name: "יעל פרץ",
    emergency_contact_phone: "0549003300",
    insurance_provider: "כלל בריאות",
    coverage_track: "פרטי",
    communication_preference: "מייל + וואטסאפ",
    preferred_days: "שלישי, שישי",
    attendance_risk: "נמוך",
    functional_status: "עובד במשרה מלאה אך קם לעיתים תכופות ומגביל נהיגה ארוכה.",
    payment_balance: 320,
    therapistName: "עמית כהן",
    appointments: [
      {
        daysOffset: 1,
        hour: 12,
        minute: 0,
        room: "חדר 1",
        summary: "אבחון ראשוני והדרכת מנח",
      },
    ],
    journalEntries: [],
  },
];

const defaultAppointmentForm: AppointmentForm = {
  patient_id: "",
  therapist_id: "",
  appointment_day: "",
  appointment_month: "",
  appointment_year: "",
  appointment_hour: "",
  appointment_minute: "00",
  room: "",
  summary: "",
};

const defaultAddTherapistForm: AddTherapistForm = {
  full_name: "",
  profession: "פיזיותרפיה",
  specialty: "",
  phone: "",
};

const reminderLogStorageKey = "clinicflow-reminder-log-v3";
const reminderItemsStorageKey = "clinicflow-reminder-items-v3";
const legacyReminderLogStorageKeys = [
  "clinicflow-reminder-log-v1",
  "clinicflow-reminder-log-v2",
  "clinicflow-reminder-log-v3",
];
const legacyReminderItemsStorageKeys = [
  "clinicflow-reminder-items-v1",
  "clinicflow-reminder-items-v2",
  "clinicflow-reminder-items-v3",
];

function normalizeReminderNotice(notice: ReminderNotice) {
  return {
    ...notice,
    sentAt: notice.sentAt ?? null,
  };
}

function persistReminderNoticesToStorage(nextNotices: ReminderNotice[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    reminderItemsStorageKey,
    JSON.stringify(nextNotices.map(normalizeReminderNotice)),
  );
}

function mergeReminderNotices(
  currentNotices: ReminderNotice[],
  nextNotices: ReminderNotice[],
) {
  const merged = new Map<string, ReminderNotice>();

  [...nextNotices.map(normalizeReminderNotice), ...currentNotices].forEach((notice) => {
    if (!merged.has(notice.id)) {
      merged.set(notice.id, notice);
    }
  });

  return Array.from(merged.values()).slice(0, 30);
}

function getResolvedTherapistId(
  appointment: Appointment,
  patientsById: Map<string, Patient>,
) {
  return appointment.therapist_id ?? patientsById.get(appointment.patient_id)?.therapist_id ?? "";
}

function isPatientReminderNotice(notice: ReminderNotice) {
  return (
    notice.audience === "patient" &&
    !notice.id.endsWith(":therapist") &&
    !notice.title.includes("למטפל")
  );
}

function getReminderTitle(kind: ReminderKind) {
  if (kind === "confirmation") {
    return "אישור קביעת תור";
  }

  return "תזכורת למטופל";
}

function getJournalTemplate(templateKey: string, discipline?: string) {
  const fallbackTemplate =
    journalTemplates.find((template) => template.key === "followup") ?? journalTemplates[0];
  const matchingTemplate =
    journalTemplates.find((template) => template.key === templateKey) ?? fallbackTemplate;

  if (!discipline || matchingTemplate.disciplines.includes(discipline)) {
    return matchingTemplate;
  }

  return (
    journalTemplates.find((template) => template.disciplines.includes(discipline)) ??
    fallbackTemplate
  );
}

function createTemplateAnswers(
  template: JournalTemplate,
  current?: Record<string, string>,
) {
  return Object.fromEntries(
    template.sections.map((section) => [section.key, current?.[section.key] ?? ""]),
  );
}

function buildStructuredJournalNote(form: JournalForm, discipline?: string) {
  const template = getJournalTemplate(form.templateKey, discipline);
  const structuredSections = template.sections
    .map((section) => {
      const value = form.templateAnswers[section.key]?.trim();
      return value ? `${section.label}: ${value}` : "";
    })
    .filter(Boolean);

  if (structuredSections.length === 0 && !form.latestNote.trim()) {
    return "";
  }

  return [
    `תבנית: ${template.label}`,
    ...structuredSections,
    form.latestNote.trim() ? `סיכום חופשי: ${form.latestNote.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildJournalForm(patient?: Patient): JournalForm {
  const template = getJournalTemplate("followup", patient?.discipline);
  if (!patient) {
    return {
      ...defaultJournalForm,
      templateKey: template.key,
      templateAnswers: createTemplateAnswers(template),
    };
  }

  return {
    status: patient.status,
    diagnosis: patient.diagnosis ?? "",
    goal: patient.treatment_goal ?? "",
    templateKey: template.key,
    templateAnswers: createTemplateAnswers(template),
    latestNote: "",
    homeProgram: "",
    phone: patient.phone ?? "",
  };
}

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
    timeZone: "Asia/Jerusalem",
  });
}

function formatJournalDate(value: string) {
  return new Date(value).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getAppointmentFormParts(value: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(value));
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
}

function buildReminderLogKey(
  appointmentId: string,
  kind: ReminderKind,
  audience: "therapist" | "patient",
) {
  return `${appointmentId}:${kind}:${audience}`;
}

function buildWhatsAppUrl(phone?: string | null, message?: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) {
    return "";
  }

  const text = encodeURIComponent(message ?? "");
  return `https://api.whatsapp.com/send?phone=${normalizedPhone}${text ? `&text=${text}` : ""}`;
}

export function ClinicFlowApp({
  therapists: initialTherapists,
  initialPatients,
  appointments: initialAppointments,
  accessContext,
}: ClinicFlowAppProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [currentRole, setCurrentRole] = useState<AppRole>(accessContext.role);
  const visibleSections = useMemo(
    () => getVisibleSections(currentRole),
    [currentRole],
  );
  const [activeSection, setActiveSection] = useState<AppSection>(
    visibleSections[0]?.key ?? "dashboard",
  );
  const [therapists, setTherapists] = useState(initialTherapists);
  const [patients, setPatients] = useState(initialPatients);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatients[0]?.id ?? "",
  );
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showPatientDialog, setShowPatientDialog] = useState(false);
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showTherapistDialog, setShowTherapistDialog] = useState(false);
  const [editingTherapistId, setEditingTherapistId] = useState("");
  const [reminderNotices, setReminderNotices] = useState<ReminderNotice[]>([]);
  const [addPatientForm, setAddPatientForm] =
    useState<AddPatientForm>(defaultAddPatientForm);
  const [addTherapistForm, setAddTherapistForm] =
    useState<AddTherapistForm>(defaultAddTherapistForm);
  const [journalForm, setJournalForm] = useState<JournalForm>(() =>
    buildJournalForm(initialPatients[0]),
  );
  const [patientSaveStatus, setPatientSaveStatus] = useState("");
  const [therapistSaveStatus, setTherapistSaveStatus] = useState("");
  const [journalSaveStatus, setJournalSaveStatus] = useState("");
  const [appointmentSaveStatus, setAppointmentSaveStatus] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isAddingTherapist, setIsAddingTherapist] = useState(false);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState("");
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [demoSeedStatus, setDemoSeedStatus] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialPatients.map((patient) => [patient.id, patient.status])),
  );
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>({
    ...defaultAppointmentForm,
    patient_id: initialPatients[0]?.id ?? "",
    therapist_id: initialPatients[0]?.therapist_id ?? "",
  });

  const therapistNameById = useMemo(
    () => new Map(therapists.map((therapist) => [therapist.id, therapist.full_name])),
    [therapists],
  );
  const therapistById = useMemo(
    () => new Map(therapists.map((therapist) => [therapist.id, therapist])),
    [therapists],
  );

  const defaultTherapistByDiscipline = useMemo(() => {
    const map = new Map<string, string | null>();
    therapists.forEach((therapist) => {
      if (!map.has(therapist.profession)) {
        map.set(therapist.profession, therapist.id);
      }
    });
    return map;
  }, [therapists]);

  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];

  const filteredPatients = patients.filter((patient) =>
    [patient.full_name, patient.discipline, patient.status]
      .join(" ")
      .includes(search.trim()),
  );
  const appointmentPatientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );
  const nextAppointmentByPatientId = useMemo(() => {
    const map = new Map<string, Appointment>();
    appointments.forEach((appointment) => {
      if (!map.has(appointment.patient_id)) {
        map.set(appointment.patient_id, appointment);
      }
    });
    return map;
  }, [appointments]);
  const appointmentById = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments],
  );
  const selectedPatientAppointments = appointments.filter(
    (appointment) => appointment.patient_id === selectedPatient?.id,
  );
  const nextAppointmentForSelectedPatient = selectedPatientAppointments[0];
  const selectedPatientReadiness = selectedPatient
    ? [
        {
          label: "טלפון מטופל",
          done: Boolean(selectedPatient.phone?.trim()),
          hint: selectedPatient.phone ? selectedPatient.phone : "חסר מספר לעדכונים ותזכורות",
        },
        {
          label: "אבחנה עדכנית",
          done: Boolean(selectedPatient.diagnosis?.trim()),
          hint: selectedPatient.diagnosis ? "קיימת אבחנה בתיק" : "מומלץ להשלים אבחנה",
        },
        {
          label: "יעד טיפולי",
          done: Boolean(selectedPatient.treatment_goal?.trim()),
          hint: selectedPatient.treatment_goal ? "היעד קיים בתיק" : "חסר יעד טיפולי מסודר",
        },
        {
          label: "תור עתידי",
          done: Boolean(nextAppointmentForSelectedPatient),
          hint: nextAppointmentForSelectedPatient
            ? `${formatAppointmentDate(nextAppointmentForSelectedPatient.appointment_at)} | ${formatAppointmentTime(nextAppointmentForSelectedPatient.appointment_at)}`
            : "אין כרגע טיפול המשך קבוע",
        },
      ]
    : [];
  const today = new Date();
  const todayKey = today.toDateString();
  const now = today.getTime();
  const todayAppointments = appointments.filter(
    (appointment) => new Date(appointment.appointment_at).toDateString() === todayKey,
  );
  const upcomingAppointments = appointments.filter(
    (appointment) => new Date(appointment.appointment_at).getTime() > now
      && new Date(appointment.appointment_at).toDateString() !== todayKey,
  );
  const pastAppointments = appointments.filter(
    (appointment) => new Date(appointment.appointment_at).getTime() < now
      && new Date(appointment.appointment_at).toDateString() !== todayKey,
  );
  const recentNotices = reminderNotices.filter(isPatientReminderNotice).slice(0, 6);

  const stats = [
    {
      label: "מטופלים פעילים",
      value: patients.filter((patient) => patient.status === "בטיפול").length,
      note: "בטיפול",
    },
    {
      label: "סה\"כ תורים",
      value: appointments.length,
      note: "ביומן",
    },
    {
      label: "מטופלים במעקב",
      value: patients.filter((patient) => patient.status === "מעקב").length,
      note: "לבדיקה",
    },
    {
      label: "מטפלים",
      value: therapists.length,
      note: "פעילים",
    },
  ];

  const breakdown = [
    {
      label: "פיזיותרפיה",
      value: `${patients.filter((patient) => patient.discipline === "פיזיותרפיה").length} מטופלים`,
    },
    {
      label: "ריפוי בעיסוק",
      value: `${patients.filter((patient) => patient.discipline === "ריפוי בעיסוק").length} מטופלים`,
    },
  ];

  const followups = patients
    .filter((patient) => patient.status === "מעקב" || patient.status === "חדש")
    .slice(0, 3)
    .map((patient) => ({
      label: patient.full_name,
      value: patient.status === "חדש" ? "דורש אבחון ראשוני" : "מומלץ לתאם המשך טיפול",
    }));

  const dayOptions = Array.from({ length: 31 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
  const monthOptions = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, index) =>
    String(currentYear + index),
  );
  const hourOptions = Array.from({ length: 13 }, (_, index) =>
    String(index + 8).padStart(2, "0"),
  );
  const minuteOptions = ["00", "15", "30", "45"];
  const activeJournalTemplate = useMemo(
    () => getJournalTemplate(journalForm.templateKey, selectedPatient?.discipline),
    [journalForm.templateKey, selectedPatient?.discipline],
  );
  const patientManagementEnabled = canManagePatients(currentRole);
  const appointmentManagementEnabled = canManageAppointments(currentRole);
  const clinicalNotesEnabled = canEditClinicalNotes(currentRole);

  useEffect(() => {
    if (!visibleSections.some((section) => section.key === activeSection)) {
      setActiveSection(visibleSections[0]?.key ?? "dashboard");
    }
  }, [activeSection, visibleSections]);

  function prependReminderNotices(nextNotices: ReminderNotice[]) {
    setReminderNotices((current) => {
      const cleaned = mergeReminderNotices(current, nextNotices).filter(
        isPatientReminderNotice,
      );
      persistReminderNoticesToStorage(cleaned);
      return cleaned;
    });
  }

  function markReminderNoticeSent(noticeId: string) {
    const sentAt = new Date().toISOString();
    setReminderNotices((current) => {
      const nextNotices = current.map((notice) =>
        notice.id === noticeId ? { ...notice, sentAt } : notice,
      );
      const cleaned = nextNotices.filter(isPatientReminderNotice);
      persistReminderNoticesToStorage(cleaned);
      return cleaned;
    });
  }

  useEffect(() => {
    setTherapists(initialTherapists);
  }, [initialTherapists]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    legacyReminderLogStorageKeys.forEach((key) => {
      if (key !== reminderLogStorageKey) {
        window.localStorage.removeItem(key);
      }
    });
    legacyReminderItemsStorageKeys.forEach((key) => {
      if (key !== reminderItemsStorageKey) {
        window.localStorage.removeItem(key);
      }
    });

    const storedNotices = window.localStorage.getItem(reminderItemsStorageKey);
    if (storedNotices) {
      try {
        const parsed = JSON.parse(storedNotices) as ReminderNotice[];
        const cleaned = mergeReminderNotices(
          [],
          parsed
            .map(normalizeReminderNotice)
            .filter(isPatientReminderNotice),
        );
        setReminderNotices(cleaned);
        persistReminderNoticesToStorage(cleaned);
      } catch {
        window.localStorage.removeItem(reminderItemsStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    setPatients(initialPatients);
    setStatusDrafts(
      Object.fromEntries(initialPatients.map((patient) => [patient.id, patient.status])),
    );
  }, [initialPatients]);

  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  const runDemoSeedIfNeeded = useEffectEvent(() => {
    if (initialPatients.length === 0 && patients.length === 0 && !isSeedingDemo) {
      void handleLoadDemoData();
    }
  });

  useEffect(() => {
    runDemoSeedIfNeeded();
  }, [initialPatients.length, isSeedingDemo, patients.length]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    setJournalForm(buildJournalForm(selectedPatient));

    const loadEntries = async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("patient_id", selectedPatient.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        setJournalEntries([]);
        setJournalSaveStatus("לא ניתן לטעון את היסטוריית היומן כרגע");
        return;
      }

      setJournalEntries((data ?? []) as JournalEntry[]);
    };

    void loadEntries();
  }, [selectedPatient, selectedPatientId, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const runReminderCheck = () => {
      const now = Date.now();
      const rawLog = window.localStorage.getItem(reminderLogStorageKey);
      let reminderLog: Record<string, string> = {};

      if (rawLog) {
        try {
          reminderLog = JSON.parse(rawLog) as Record<string, string>;
        } catch {
          reminderLog = {};
        }
      }

      const nextNotices: ReminderNotice[] = [];

      appointments.forEach((appointment) => {
        const appointmentTime = new Date(appointment.appointment_at).getTime();
        const diffMs = appointmentTime - now;
        const resolvedTherapistId = getResolvedTherapistId(
          appointment,
          appointmentPatientById,
        );
        const patientName =
          appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל";
        const therapistName =
          therapistNameById.get(resolvedTherapistId) ?? "המטפל/ת";
        const patientPhone = appointmentPatientById.get(appointment.patient_id)?.phone ?? "";

        const reminderKinds: ReminderKind[] = [];
        if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
          reminderKinds.push("24h");
        }
        if (diffMs > 0 && diffMs <= 60 * 60 * 1000) {
          reminderKinds.push("1h");
        }

        reminderKinds.forEach((kind) => {
          const patientKey = buildReminderLogKey(appointment.id, kind, "patient");

          if (!reminderLog[patientKey]) {
            reminderLog[patientKey] = new Date().toISOString();
            nextNotices.push({
              id: patientKey,
              appointmentId: appointment.id,
              kind,
              audience: "patient",
              title: "תזכורת למטופל",
              message: `שלום ${patientName}, זו תזכורת לטיפול שנקבע עבורך ב-${formatAppointmentDate(appointment.appointment_at)} בשעה ${formatAppointmentTime(appointment.appointment_at)} עם ${therapistName}.`,
              createdAt: new Date().toISOString(),
              phone: patientPhone,
            });
          }
        });
      });

      if (nextNotices.length > 0) {
        setReminderNotices((current) => {
          const cleaned = mergeReminderNotices(current, nextNotices).filter(
            isPatientReminderNotice,
          );
          persistReminderNoticesToStorage(cleaned);
          return cleaned;
        });
        window.localStorage.setItem(reminderLogStorageKey, JSON.stringify(reminderLog));
      }
    };

    runReminderCheck();
    const intervalId = window.setInterval(runReminderCheck, 60000);
    return () => window.clearInterval(intervalId);
  }, [appointments, appointmentPatientById, therapistById, therapistNameById]);

  async function handleAddPatientSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAddingPatient(true);
    setPatientSaveStatus("");

    const therapistId =
      defaultTherapistByDiscipline.get(addPatientForm.discipline) ?? null;

    const { data, error } = await supabase
      .from("patients")
      .insert({
        full_name: addPatientForm.full_name.trim(),
        discipline: addPatientForm.discipline,
        status: addPatientForm.status,
        diagnosis: addPatientForm.diagnosis.trim() || null,
        treatment_goal: addPatientForm.treatment_goal.trim() || null,
        therapist_id: therapistId,
        phone: addPatientForm.phone.trim() || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      setIsAddingPatient(false);
      setPatientSaveStatus("הוספת המטופל נכשלה. צריך לאפשר כתיבה ב-Supabase.");
      return;
    }

    const insertedPatient = data as Patient;
    setPatients((current) => [insertedPatient, ...current]);
    setSelectedPatientId(insertedPatient.id);
    setAppointmentForm((current) => ({
      ...current,
      patient_id: insertedPatient.id,
      therapist_id: insertedPatient.therapist_id ?? "",
    }));
    setAddPatientForm(defaultAddPatientForm);
    setShowPatientDialog(false);
    setActiveSection("patients");
    setIsAddingPatient(false);
  }

  async function handleAddTherapistSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAddingTherapist(true);
    setTherapistSaveStatus("");

    const payload = {
      full_name: addTherapistForm.full_name.trim(),
      profession: addTherapistForm.profession,
      specialty: addTherapistForm.specialty.trim() || null,
      phone: addTherapistForm.phone.trim() || null,
    };

    const query = editingTherapistId
      ? supabase
          .from("therapists")
          .update(payload)
          .eq("id", editingTherapistId)
          .select("*")
          .single()
      : supabase.from("therapists").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error || !data) {
      setIsAddingTherapist(false);
      setTherapistSaveStatus(
        editingTherapistId
          ? "עדכון המטפל נכשל. צריך לאפשר update ב-Supabase."
          : "הוספת המטפל נכשלה. צריך לאפשר כתיבה ב-Supabase.",
      );
      return;
    }

    const nextTherapist = data as Therapist;
    setTherapists((current) => {
      if (editingTherapistId) {
        return current.map((therapist) =>
          therapist.id === nextTherapist.id ? nextTherapist : therapist,
        );
      }
      return [...current, nextTherapist];
    });
    setAddTherapistForm(defaultAddTherapistForm);
    setShowTherapistDialog(false);
    setIsAddingTherapist(false);
    setEditingTherapistId("");
    setTherapistSaveStatus("");
  }

  function handleEditTherapist(therapist: Therapist) {
    setEditingTherapistId(therapist.id);
    setAddTherapistForm({
      full_name: therapist.full_name,
      profession: therapist.profession,
      specialty: therapist.specialty ?? "",
      phone: therapist.phone ?? "",
    });
    setTherapistSaveStatus("");
    setShowTherapistDialog(true);
  }

  async function handleDeleteTherapist(therapistId: string) {
    const therapistName =
      therapists.find((therapist) => therapist.id === therapistId)?.full_name ?? "המטפל";
    const confirmed = window.confirm(`למחוק את ${therapistName}?`);
    if (!confirmed) {
      return;
    }

    setDeleteStatus("");
    const { error } = await supabase.from("therapists").delete().eq("id", therapistId);

    if (error) {
      setDeleteStatus("מחיקת המטפל נכשלה. צריך לאפשר delete ב-Supabase.");
      return;
    }

    setTherapists((current) => current.filter((therapist) => therapist.id !== therapistId));
    setDeleteStatus("המטפל נמחק בהצלחה");
  }

  async function handleJournalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      return;
    }

    setIsSavingJournal(true);
    setJournalSaveStatus("");

    const { data: updatedPatient, error: patientError } = await supabase
      .from("patients")
      .update({
        status: journalForm.status,
        diagnosis: journalForm.diagnosis.trim() || null,
        treatment_goal: journalForm.goal.trim() || null,
        phone: journalForm.phone.trim() || null,
      })
      .eq("id", selectedPatient.id)
      .select("*")
      .single();

    if (patientError || !updatedPatient) {
      setIsSavingJournal(false);
      setJournalSaveStatus(
        "שמירת תיק המטופל נכשלה. אם זה ממשיך, כנראה שצריך לאפשר עדכון ב-Supabase.",
      );
      return;
    }

    let insertedEntry: JournalEntry | null = null;
    const noteContent = buildStructuredJournalNote(
      journalForm,
      selectedPatient.discipline,
    ).trim();

    if (noteContent) {
      const { data: journalData, error: journalError } = await supabase
        .from("journal_entries")
        .insert({
          patient_id: selectedPatient.id,
          therapist_id: selectedPatient.therapist_id,
          content: noteContent,
          home_program: journalForm.homeProgram.trim() || null,
        })
        .select("*")
        .single();

      if (journalError) {
        setIsSavingJournal(false);
        setJournalSaveStatus(
          "התיק נשמר, אבל לא ניתן היה לשמור את רשומת היומן. ייתכן שחסרה הרשאת Insert ב-Supabase.",
        );
        return;
      }

      insertedEntry = journalData as JournalEntry;
    }

    const nextPatient = updatedPatient as Patient;
    setPatients((current) =>
      current.map((patient) => (patient.id === nextPatient.id ? nextPatient : patient)),
    );
    setJournalForm(buildJournalForm(nextPatient));
    if (insertedEntry) {
      setJournalEntries((current) => [insertedEntry as JournalEntry, ...current]);
    }
    setIsSavingJournal(false);
    setJournalSaveStatus("היומן נשמר בהצלחה");
  }

  async function handleAppointmentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !appointmentForm.patient_id ||
      !appointmentForm.appointment_day ||
      !appointmentForm.appointment_month ||
      !appointmentForm.appointment_year ||
      !appointmentForm.appointment_hour ||
      !appointmentForm.appointment_minute
    ) {
      setAppointmentSaveStatus("צריך לבחור מטופל, תאריך ושעה");
      return;
    }

    setIsSavingAppointment(true);
    setAppointmentSaveStatus("");

    const therapistId =
      appointmentForm.therapist_id ||
      patients.find((patient) => patient.id === appointmentForm.patient_id)?.therapist_id ||
      null;

    const appointmentAt = new Date(
      Number(appointmentForm.appointment_year),
      Number(appointmentForm.appointment_month) - 1,
      Number(appointmentForm.appointment_day),
      Number(appointmentForm.appointment_hour),
      Number(appointmentForm.appointment_minute),
    ).toISOString();

    const payload = {
      patient_id: appointmentForm.patient_id,
      therapist_id: therapistId,
      appointment_at: appointmentAt,
      room: appointmentForm.room.trim() || null,
      status: "scheduled",
      summary: appointmentForm.summary.trim() || null,
    };

    const query = editingAppointmentId
      ? supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingAppointmentId)
          .select("*")
          .single()
      : supabase.from("appointments").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error || !data) {
      setIsSavingAppointment(false);
      setAppointmentSaveStatus(editingAppointmentId
        ? "עדכון התור נכשל. כנראה שצריך לאפשר update לטבלת appointments ב-Supabase."
        : "קביעת הטיפול נכשלה. כנראה שצריך לאפשר כתיבה לטבלת appointments ב-Supabase.");
      return;
    }

    const nextAppointment = data as Appointment;
    setAppointments((current) => {
      const withoutEdited = current.filter((appointment) => appointment.id !== nextAppointment.id);
      return [...withoutEdited, nextAppointment].sort((a, b) =>
        a.appointment_at.localeCompare(b.appointment_at),
      );
    });

    if (typeof window !== "undefined" && !editingAppointmentId) {
      const resolvedTherapistId = getResolvedTherapistId(
        nextAppointment,
        appointmentPatientById,
      );
      const patientName =
        appointmentPatientById.get(nextAppointment.patient_id)?.full_name ?? "מטופל";
      const therapistName =
        therapistNameById.get(resolvedTherapistId) ?? "המטפל/ת";
      const patientPhone = appointmentPatientById.get(nextAppointment.patient_id)?.phone ?? "";

      const confirmationNotices: ReminderNotice[] = [
        {
          id: buildReminderLogKey(nextAppointment.id, "confirmation", "patient"),
          appointmentId: nextAppointment.id,
          kind: "confirmation",
          audience: "patient",
          title: "אישור קביעת תור למטופל",
          message: `שלום ${patientName}, נקבע עבורך טיפול ב-${formatAppointmentDate(nextAppointment.appointment_at)} בשעה ${formatAppointmentTime(nextAppointment.appointment_at)} עם ${therapistName}.`,
          createdAt: new Date().toISOString(),
          phone: patientPhone,
        },
      ];

      const rawLog = window.localStorage.getItem(reminderLogStorageKey);
      let reminderLog: Record<string, string> = {};
      if (rawLog) {
        try {
          reminderLog = JSON.parse(rawLog) as Record<string, string>;
        } catch {
          reminderLog = {};
        }
      }

      confirmationNotices.forEach((notice) => {
        reminderLog[notice.id] = notice.createdAt;
      });

      prependReminderNotices(confirmationNotices);
      window.localStorage.setItem(reminderLogStorageKey, JSON.stringify(reminderLog));
      setDeleteStatus("התור נקבע. נוצרה התראת WhatsApp מוכנה למטופל.");
    }

    setAppointmentForm({
      ...defaultAppointmentForm,
      patient_id: appointmentForm.patient_id,
      therapist_id: therapistId ?? "",
    });
    setIsSavingAppointment(false);
    setShowAppointmentDialog(false);
    setEditingAppointmentId("");
    setAppointmentSaveStatus(editingAppointmentId ? "התור עודכן בהצלחה" : "הטיפול נקבע בהצלחה");
    setActiveSection("appointments");
  }

  function handleEditAppointment(appointment: Appointment) {
    const appointmentDate = getAppointmentFormParts(appointment.appointment_at);
    setEditingAppointmentId(appointment.id);
    setAppointmentForm({
      patient_id: appointment.patient_id,
      therapist_id: appointment.therapist_id ?? "",
      appointment_day: appointmentDate.day,
      appointment_month: appointmentDate.month,
      appointment_year: appointmentDate.year,
      appointment_hour: appointmentDate.hour,
      appointment_minute:
        minuteOptions.find((minute) => minute === appointmentDate.minute) ??
        "00",
      room: appointment.room ?? "",
      summary: appointment.summary ?? "",
    });
    setAppointmentSaveStatus("");
    setShowAppointmentDialog(true);
    setActiveSection("appointments");
  }

  async function handleQuickStatusSave(patientId: string) {
    const nextStatus = statusDrafts[patientId];
    if (!nextStatus) {
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .update({ status: nextStatus })
      .eq("id", patientId)
      .select("*")
      .single();

    if (error || !data) {
      setDeleteStatus("עדכון הסטטוס נכשל. כנראה שצריך לאפשר update ב-Supabase.");
      return;
    }

    const updatedPatient = data as Patient;
    setPatients((current) =>
      current.map((patient) => (patient.id === updatedPatient.id ? updatedPatient : patient)),
    );
    if (selectedPatientId === updatedPatient.id) {
      setJournalForm((current) => ({ ...current, status: updatedPatient.status }));
    }
    setDeleteStatus("סטטוס המטופל עודכן בהצלחה");
  }

  async function handleDeleteAppointment(appointmentId: string) {
    const confirmed = window.confirm("למחוק את התור הזה?");
    if (!confirmed) {
      return;
    }

    setDeleteStatus("");
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointmentId);

    if (error) {
      setDeleteStatus("מחיקת התור נכשלה. צריך לאפשר delete ב-Supabase.");
      return;
    }

    setAppointments((current) =>
      current.filter((appointment) => appointment.id !== appointmentId),
    );
    setDeleteStatus("התור נמחק בהצלחה");
  }

  async function handleDeletePatient(patientId: string) {
    const patientName =
      patients.find((patient) => patient.id === patientId)?.full_name ?? "המטופל";
    const confirmed = window.confirm(`למחוק את ${patientName}?`);
    if (!confirmed) {
      return;
    }

    setDeleteStatus("");
    const { error } = await supabase.from("patients").delete().eq("id", patientId);

    if (error) {
      setDeleteStatus("מחיקת המטופל נכשלה. צריך לאפשר delete ב-Supabase.");
      return;
    }

    const nextPatients = patients.filter((patient) => patient.id !== patientId);
    setPatients(nextPatients);
    setAppointments((current) =>
      current.filter((appointment) => appointment.patient_id !== patientId),
    );
    setJournalEntries([]);
    setSelectedPatientId(nextPatients[0]?.id ?? "");
    setDeleteStatus("המטופל נמחק בהצלחה");
  }

  function handleSelectPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setAppointmentForm((current) => ({
      ...current,
      patient_id: patientId,
      therapist_id: patient?.therapist_id ?? current.therapist_id,
    }));
    setShowJournalDialog(true);
    setJournalSaveStatus("");
  }

  function handleFocusPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setAppointmentForm((current) => ({
      ...current,
      patient_id: patientId,
      therapist_id: patient?.therapist_id ?? current.therapist_id,
    }));
    setJournalSaveStatus("");
  }

  function handleCreateAppointmentForPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setEditingAppointmentId("");
    setAppointmentForm({
      ...defaultAppointmentForm,
      patient_id: patientId,
      therapist_id: patient?.therapist_id ?? "",
      room: "",
      summary: patient ? `מפגש המשך עבור ${patient.full_name}` : "",
    });
    setAppointmentSaveStatus("");
    setShowAppointmentDialog(true);
    setActiveSection("appointments");
  }

  function getNoticePhone(notice: ReminderNotice) {
    if (notice.phone) {
      return notice.phone;
    }

    const appointment = appointmentById.get(notice.appointmentId);
    if (!appointment) {
      return "";
    }

    if (notice.audience === "patient") {
      return appointmentPatientById.get(appointment.patient_id)?.phone ?? "";
    }

    return therapistById.get(getResolvedTherapistId(appointment, appointmentPatientById))?.phone ?? "";
  }

  function getAppointmentReminderMessage(appointment: Appointment) {
    const patientName =
      appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל";
    const therapistName =
      therapistById.get(getResolvedTherapistId(appointment, appointmentPatientById))?.full_name ??
      "המטפל/ת";
    const appointmentDate = formatAppointmentDate(appointment.appointment_at);
    const appointmentTime = formatAppointmentTime(appointment.appointment_at);

    return `שלום ${patientName}, זו תזכורת לטיפול שנקבע עבורך ב-${appointmentDate} בשעה ${appointmentTime} עם ${therapistName}.`;
  }

  function getAppointmentReminderUrl(appointment: Appointment) {
    const patientPhone = appointmentPatientById.get(appointment.patient_id)?.phone ?? "";
    return buildWhatsAppUrl(patientPhone, getAppointmentReminderMessage(appointment));
  }

  function getNoticeMessage(notice: ReminderNotice) {
    const appointment = appointmentById.get(notice.appointmentId);
    if (!appointment) {
      return notice.message;
    }

    const patientName =
      appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל";
    const therapistName =
      therapistById.get(getResolvedTherapistId(appointment, appointmentPatientById))?.full_name ??
      "המטפל/ת";
    const appointmentDate = formatAppointmentDate(appointment.appointment_at);
    const appointmentTime = formatAppointmentTime(appointment.appointment_at);

    if (notice.kind === "confirmation") {
      if (notice.audience === "patient") {
        return `שלום ${patientName}, נקבע עבורך טיפול ב-${appointmentDate} בשעה ${appointmentTime} עם ${therapistName}.`;
      }

      return `${patientName} נקבע/ה ל-${appointmentDate} בשעה ${appointmentTime} עם ${therapistName}`;
    }

    if (notice.audience === "patient") {
      return `שלום ${patientName}, זו תזכורת לטיפול שנקבע עבורך ב-${appointmentDate} בשעה ${appointmentTime} עם ${therapistName}.`;
    }

    return `${patientName} קבוע/ה עם ${therapistName} ב-${appointmentDate} בשעה ${appointmentTime}`;
  }

  function getNoticeTitle(notice: ReminderNotice) {
    return getReminderTitle(notice.kind);
  }

  function handleOpenAppointmentDialog() {
    setEditingAppointmentId("");
    setAppointmentForm({
      ...defaultAppointmentForm,
      patient_id: selectedPatient?.id ?? "",
      therapist_id: selectedPatient?.therapist_id ?? "",
    });
    setAppointmentSaveStatus("");
    setShowAppointmentDialog(true);
    setActiveSection("appointments");
  }

  async function handleLoadDemoData() {
    if (isSeedingDemo) {
      return;
    }

    setIsSeedingDemo(true);
    setDemoSeedStatus("");

    try {
      const existingNames = new Set(patients.map((patient) => patient.full_name));
      const patientsToSeed = demoPatients.filter(
        (patient) => !existingNames.has(patient.full_name),
      );

      if (patientsToSeed.length === 0) {
        setDemoSeedStatus("נתוני הדמו כבר נוספו קודם. חפש מטופלים שמתחילים ב-\"דמו\"");
        return;
      }

      const demoTherapistRows: Therapist[] = demoTherapists.map((therapist) => ({
        id: crypto.randomUUID(),
        full_name: therapist.full_name,
        profession: therapist.profession,
        specialty: therapist.specialty,
        phone: therapist.phone,
      }));

      const therapistMap = new Map(
        demoTherapistRows.map((therapist) => [therapist.full_name, therapist]),
      );

      const demoPatientRows: Patient[] = patientsToSeed.map((patient) => ({
        id: crypto.randomUUID(),
        full_name: patient.full_name,
        discipline: patient.discipline,
        status: patient.status,
        diagnosis: patient.diagnosis,
        treatment_goal: patient.treatment_goal,
        therapist_id: therapistMap.get(patient.therapistName)?.id ?? null,
        phone: patient.phone,
        email: patient.email,
        city: patient.city,
        address: patient.address,
        birth_date: patient.birth_date,
        gender: patient.gender,
        occupation: patient.occupation,
        referring_source: patient.referring_source,
        intake_summary: patient.intake_summary,
        medical_background: patient.medical_background,
        medications: patient.medications,
        allergies: patient.allergies,
        emergency_contact_name: patient.emergency_contact_name,
        emergency_contact_phone: patient.emergency_contact_phone,
        insurance_provider: patient.insurance_provider,
        coverage_track: patient.coverage_track,
        communication_preference: patient.communication_preference,
        preferred_days: patient.preferred_days,
        attendance_risk: patient.attendance_risk,
        functional_status: patient.functional_status,
        payment_balance: patient.payment_balance,
      }));

      const patientMap = new Map(
        demoPatientRows.map((patient) => [patient.full_name, patient]),
      );

      const demoAppointmentRows: Appointment[] = patientsToSeed
        .flatMap((patient) =>
          patient.appointments.map((appointment) => {
            const date = new Date();
            date.setDate(date.getDate() + appointment.daysOffset);
            date.setHours(appointment.hour, appointment.minute, 0, 0);

            return {
              id: crypto.randomUUID(),
              patient_id: patientMap.get(patient.full_name)?.id ?? "",
              therapist_id: therapistMap.get(patient.therapistName)?.id ?? null,
              appointment_at: date.toISOString(),
              room: appointment.room,
              status: appointment.status ?? "scheduled",
              summary: appointment.summary,
            };
          }),
        )
        .sort(
          (a, b) =>
            new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime(),
        );

      const demoJournalRows: JournalEntry[] = patientsToSeed.flatMap((patient) =>
        patient.journalEntries.map((entry) => {
          const date = new Date();
          date.setDate(date.getDate() + entry.daysOffset);
          date.setHours(9, 0, 0, 0);

          return {
            id: crypto.randomUUID(),
            patient_id: patientMap.get(patient.full_name)?.id ?? "",
            therapist_id: therapistMap.get(patient.therapistName)?.id ?? null,
            entry_date: date.toISOString().slice(0, 10),
            content: entry.content,
            home_program: entry.homeProgram ?? null,
            created_at: date.toISOString(),
          };
        }),
      );

      setTherapists((current) => [...demoTherapistRows, ...current]);
      setPatients((current) => [...demoPatientRows, ...current]);
      setAppointments((current) =>
        [...current, ...demoAppointmentRows].sort(
          (a, b) =>
            new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime(),
        ),
      );
      setJournalEntries(demoJournalRows.filter((entry) => entry.patient_id === demoPatientRows[0]?.id));
      setStatusDrafts((current) => ({
        ...current,
        ...Object.fromEntries(demoPatientRows.map((patient) => [patient.id, patient.status])),
      }));
      setSelectedPatientId(demoPatientRows[0]?.id ?? selectedPatientId);
      setDemoSeedStatus("נטענו נתוני דמו מקומיים בהצלחה. חפש מטופלים שמתחילים ב-\"דמו\"");
      setActiveSection("patients");
    } catch (error) {
      const message = error instanceof Error ? error.message : "טעינת נתוני הדמו נכשלה";
      setDemoSeedStatus(message);
    } finally {
      setIsSeedingDemo(false);
    }
  }

  function handleJournalTemplateChange(templateKey: string) {
    const nextTemplate = getJournalTemplate(templateKey, selectedPatient?.discipline);
    setJournalForm((current) => ({
      ...current,
      templateKey: nextTemplate.key,
      templateAnswers: createTemplateAnswers(nextTemplate, current.templateAnswers),
    }));
  }

  function handleJournalTemplateAnswerChange(fieldKey: string, value: string) {
    setJournalForm((current) => ({
      ...current,
      templateAnswers: {
        ...current.templateAnswers,
        [fieldKey]: value,
      },
    }));
  }

  function handleJournalSuggestionInsert(fieldKey: string, suggestion: string) {
    setJournalForm((current) => {
      const currentValue = current.templateAnswers[fieldKey]?.trim();

      return {
        ...current,
        templateAnswers: {
          ...current.templateAnswers,
          [fieldKey]: currentValue ? `${currentValue}, ${suggestion}` : suggestion,
        },
      };
    });
  }

  function handleGenerateStructuredSummary() {
    setJournalForm((current) => ({
      ...current,
      latestNote: buildStructuredJournalNote(current, selectedPatient?.discipline),
    }));
  }

  return (
    <>
      <main className="page-shell">
        <section className="content">
          <header className="topbar">
            <div className="topbar-copy">
              <p className="eyebrow">ClinicFlow</p>
              <h1>מערכת המכון</h1>
              <span className="topbar-meta">
                {accessContext.clinicName} | {getRoleLabel(currentRole)}
              </span>
            </div>

            <nav className="top-nav">
              {visibleSections.map(({ key, label }) => (
              <button
                key={key}
                className={`nav-link ${activeSection === key ? "active" : ""}`}
                data-section={key}
                onClick={() => setActiveSection(key)}
                type="button"
                >
                  {label}
                </button>
              ))}
            </nav>

            <section className="topbar-summary">
              <div className="summary-pill role-pill">
                <strong>{accessContext.displayName}</strong>
                <span>{getRoleLabel(currentRole)}</span>
              </div>
              <div className="summary-pill role-switch-pill">
                <strong>מצב בדיקה</strong>
                <select
                  value={currentRole}
                  onChange={(event) => setCurrentRole(event.target.value as AppRole)}
                >
                  <option value="admin">מנהל/ת</option>
                  <option value="therapist">מטפל/ת</option>
                  <option value="reception">קבלה</option>
                  <option value="finance">כספים</option>
                </select>
              </div>
              <div className="summary-pill">
                <strong>{todayAppointments.length}</strong>
                <span>תורים היום</span>
              </div>
              <div className="summary-pill">
                <strong>{patients.length}</strong>
                <span>מטופלים</span>
              </div>
            </section>
          </header>

          <section className="hero">
            <div>
              <p className="section-tag">עמוד ראשי</p>
              <h2>ניהול שוטף של המטופלים והתורים</h2>
              <p>בחר פעולה כדי להוסיף מטופל חדש או לקבוע טיפול.</p>
            </div>
            <div className="hero-actions">
              {patientManagementEnabled ? (
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => setShowPatientDialog(true)}
                >
                  הוספת מטופל
                </button>
              ) : null}
              {appointmentManagementEnabled ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={handleOpenAppointmentDialog}
                >
                  מעבר ליומן
                </button>
              ) : null}
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  void handleLoadDemoData();
                }}
                disabled={isSeedingDemo}
              >
                {isSeedingDemo ? "טוען דמו..." : "טעינת נתוני דמו"}
              </button>
            </div>
            {demoSeedStatus ? <div className="demo-status-banner">{demoSeedStatus}</div> : null}
          </section>

          <section className={`panel ${activeSection === "dashboard" ? "active" : ""}`}>
            <div className="stats-grid">
              {stats.map((item) => (
                <article key={item.label} className="stat-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <div className="item-meta">{item.note}</div>
                </article>
              ))}
            </div>

            <div className="dashboard-grid">
              <article className="card">
                <div className="card-head">
                  <h3>תורים קרובים</h3>
                  <span>היום</span>
                </div>
                <div className="stack-list">
                  {appointments.slice(0, 3).map((appointment) => (
                    <div key={appointment.id} className="list-item">
                      <strong>
                        {formatAppointmentTime(appointment.appointment_at)} |{" "}
                        {patients.find((patient) => patient.id === appointment.patient_id)
                          ?.full_name ?? "מטופל לא ידוע"}
                      </strong>
                      <div className="item-meta">
                        {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל"} |{" "}
                        {appointment.room ?? "חדר לא הוגדר"}
                      </div>
                      <div>{appointment.summary ?? "טרם נכתב סיכום טיפול"}</div>
                      {getAppointmentReminderUrl(appointment) ? (
                        <a
                          className="ghost-btn inline-link-btn"
                          href={getAppointmentReminderUrl(appointment)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          שלח תזכורת
                        </a>
                      ) : (
                        <div className="item-meta">חסר מספר טלפון לשליחת תזכורת</div>
                      )}
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>התראות</h3>
                  <span>אחרונות</span>
                </div>
                <div className="stack-list">
                  {recentNotices.filter(isPatientReminderNotice).map((notice) => {
                    const noticeMessage = getNoticeMessage(notice);
                    const noticeTitle = getNoticeTitle(notice);
                    const whatsappUrl = buildWhatsAppUrl(
                      getNoticePhone(notice),
                      noticeMessage,
                    );

                    return (
                      <div key={notice.id} className="list-item">
                        <strong>{noticeTitle}</strong>
                        <div>{noticeMessage}</div>
                        <div className="item-meta">
                          {notice.audience === "therapist" ? "למטפל" : "למטופל"} |{" "}
                          {formatJournalDate(notice.createdAt)}
                        </div>
                        <div className={`notice-status ${notice.sentAt ? "sent" : "pending"}`}>
                          {notice.sentAt
                            ? `סומן כנשלח ב-${formatJournalDate(notice.sentAt)}`
                            : "ממתין לשליחה"}
                        </div>
                        {whatsappUrl ? (
                          <a
                            className="ghost-btn inline-link-btn"
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => markReminderNoticeSent(notice.id)}
                          >
                            שלח WhatsApp
                          </a>
                        ) : (
                          <div className="item-meta">חסר מספר טלפון לשליחת WhatsApp</div>
                        )}
                      </div>
                    );
                  })}
                  {recentNotices.length === 0 ? (
                    <div className="list-item">
                      <strong>אין התראות כרגע</strong>
                      <div className="item-meta">התראות על תורים יופיעו כאן אוטומטית.</div>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          </section>

          <section className={`panel ${activeSection === "patients" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">מאגר מטופלים</p>
                <h3>מטופלים ואפשרויות פעולה</h3>
              </div>
              <div className="section-tools">
                <input
                  type="search"
                  placeholder="חיפוש לפי שם, תחום או סטטוס"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="section-summary">
                  {filteredPatients.length} מתוך {patients.length} מטופלים
                </div>
              </div>
            </div>

            <div className="journal-patient-list">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className={`journal-patient-item patient-option-item ${selectedPatient?.id === patient.id ? "selected" : ""}`}
                  onClick={() => handleFocusPatient(patient.id)}
                >
                  <div>
                    <strong>{patient.full_name}</strong>
                    <div className="item-meta">
                      {patient.discipline} | {therapistNameById.get(patient.therapist_id ?? "") ?? "ללא מטפל"}
                    </div>
                  </div>
                  <div className="chips patient-option-chips">
                    <span className="chip warm">{patient.status}</span>
                    <span className="chip">
                      {nextAppointmentByPatientId.get(patient.id)
                        ? `${formatAppointmentDate(nextAppointmentByPatientId.get(patient.id)!.appointment_at)} ${formatAppointmentTime(nextAppointmentByPatientId.get(patient.id)!.appointment_at)}`
                        : "ללא תור"}
                    </span>
                  </div>
                  <div className="patient-option-actions">
                    <label className="inline-field compact-inline-field">
                      <span className="sr-only">שינוי סטטוס</span>
                      <select
                        value={statusDrafts[patient.id] ?? patient.status}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [patient.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="חדש">חדש</option>
                        <option value="בטיפול">בטיפול</option>
                        <option value="מעקב">מעקב</option>
                      </select>
                    </label>
                    {patientManagementEnabled ? (
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleQuickStatusSave(patient.id);
                        }}
                      >
                        שמירת סטטוס
                      </button>
                    ) : null}
                    {clinicalNotesEnabled ? (
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelectPatient(patient.id);
                        }}
                      >
                        פתיחת יומן
                      </button>
                    ) : null}
                    {appointmentManagementEnabled ? (
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCreateAppointmentForPatient(patient.id);
                        }}
                      >
                        קביעת טיפול
                      </button>
                    ) : null}
                    {patientManagementEnabled ? (
                      <button
                        className="danger-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeletePatient(patient.id);
                        }}
                      >
                        מחיקת מטופל
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <PatientProfileWorkspace
              patient={selectedPatient}
              appointments={selectedPatientAppointments}
              journalEntries={journalEntries}
              therapistName={
                therapistNameById.get(selectedPatient?.therapist_id ?? "") ?? "ללא מטפל"
              }
              statusDraft={selectedPatient ? statusDrafts[selectedPatient.id] ?? selectedPatient.status : "חדש"}
              canManagePatients={patientManagementEnabled}
              canManageAppointments={appointmentManagementEnabled}
              canEditClinicalNotes={clinicalNotesEnabled}
              onStatusDraftChange={(value) => {
                if (!selectedPatient) {
                  return;
                }
                setStatusDrafts((current) => ({
                  ...current,
                  [selectedPatient.id]: value,
                }));
              }}
              onStatusSave={() => {
                if (!selectedPatient) {
                  return;
                }
                void handleQuickStatusSave(selectedPatient.id);
              }}
              onOpenJournal={() => {
                if (!selectedPatient) {
                  return;
                }
                handleSelectPatient(selectedPatient.id);
              }}
              onCreateAppointment={() => {
                if (!selectedPatient) {
                  return;
                }
                handleCreateAppointmentForPatient(selectedPatient.id);
              }}
              formatAppointmentDate={formatAppointmentDate}
              formatAppointmentTime={formatAppointmentTime}
              formatJournalDate={formatJournalDate}
            />
            {deleteStatus ? <div className="item-meta">{deleteStatus}</div> : null}
          </section>

          <section className={`panel ${activeSection === "appointments" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">יומן</p>
                <h3>תורים, מטפל אחראי וחדר טיפול</h3>
              </div>
              <div className="section-tools">
                <div className="section-summary">היום: {todayAppointments.length} תורים</div>
                <div className="section-summary">בהמשך: {upcomingAppointments.length} תורים</div>
                <div className="section-summary">קודמים: {pastAppointments.length} תורים</div>
              </div>
            </div>
            <div className="card appointments-callout">
              <div>
                <strong>תורים</strong>
                <div className="item-meta">קביעת תור חדש או עריכת תור קיים</div>
              </div>
              {appointmentManagementEnabled ? (
                <button className="primary-btn" type="button" onClick={handleOpenAppointmentDialog}>
                  קביעת טיפול חדש
                </button>
              ) : (
                <div className="item-meta">לצפייה בלבד בתפקיד הנוכחי</div>
              )}
            </div>
            <div className="appointments-layout">
              <article className="card">
                <div className="card-head">
                  <h4>תורים להיום</h4>
                  <span>{todayAppointments.length} תורים</span>
                </div>
                <div className="timeline">
                  {todayAppointments.map((appointment) => (
                    <article key={appointment.id} className="timeline-item">
                      <div className="time-block">{formatAppointmentTime(appointment.appointment_at)}</div>
                      <div>
                        <strong>
                          {appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל לא ידוע"}
                        </strong>
                        <div className="chips">
                          <span className="chip">
                            {appointmentPatientById.get(appointment.patient_id)?.discipline ?? "ללא תחום"}
                          </span>
                          <span className="chip warm">{appointment.room ?? "חדר לא הוגדר"}</span>
                          <span className="chip chip-muted">
                            {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל"}
                          </span>
                        </div>
                        <p>{appointment.summary ?? "טרם נכתב סיכום טיפול"}</p>
                        <div className="appointment-actions">
                          {getAppointmentReminderUrl(appointment) ? (
                            <a
                              className="ghost-btn inline-link-btn"
                              href={getAppointmentReminderUrl(appointment)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              שלח תזכורת
                            </a>
                          ) : (
                            <div className="item-meta">חסר מספר טלפון לשליחת תזכורת</div>
                          )}
                          {clinicalNotesEnabled ? (
                            <button
                              className="ghost-btn"
                              type="button"
                              onClick={() => handleSelectPatient(appointment.patient_id)}
                            >
                              פתיחת יומן מטופל
                            </button>
                          ) : null}
                          {appointmentManagementEnabled ? (
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={() => handleEditAppointment(appointment)}
                            >
                              עריכת תור
                            </button>
                          ) : null}
                          {appointmentManagementEnabled ? (
                            <button
                              className="danger-btn"
                              type="button"
                              onClick={() => handleDeleteAppointment(appointment.id)}
                            >
                              מחיקת תור
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                  {todayAppointments.length === 0 ? (
                    <div className="empty-card">אין תורים להיום.</div>
                  ) : null}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h4>תורים בהמשך</h4>
                  <span>{upcomingAppointments.length} תורים</span>
                </div>
                <div className="timeline">
                  {upcomingAppointments.map((appointment) => (
                    <article key={appointment.id} className="timeline-item">
                      <div className="time-block">
                        <div>{formatAppointmentDate(appointment.appointment_at)}</div>
                        <div>{formatAppointmentTime(appointment.appointment_at)}</div>
                      </div>
                      <div>
                        <strong>
                          {appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל לא ידוע"}
                        </strong>
                        <div className="chips">
                          <span className="chip">
                            {appointmentPatientById.get(appointment.patient_id)?.discipline ?? "ללא תחום"}
                          </span>
                          <span className="chip warm">{appointment.room ?? "חדר לא הוגדר"}</span>
                          <span className="chip chip-muted">
                            {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל"}
                          </span>
                        </div>
                        <p>{appointment.summary ?? "טרם נכתב סיכום טיפול"}</p>
                        <div className="appointment-actions">
                          {getAppointmentReminderUrl(appointment) ? (
                            <a
                              className="ghost-btn inline-link-btn"
                              href={getAppointmentReminderUrl(appointment)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              שלח תזכורת
                            </a>
                          ) : (
                            <div className="item-meta">חסר מספר טלפון לשליחת תזכורת</div>
                          )}
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => handleSelectPatient(appointment.patient_id)}
                          >
                            פתיחת יומן מטופל
                          </button>
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() => handleEditAppointment(appointment)}
                          >
                            עריכת תור
                          </button>
                          <button
                            className="danger-btn"
                            type="button"
                            onClick={() => handleDeleteAppointment(appointment.id)}
                          >
                            מחיקת תור
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {upcomingAppointments.length === 0 ? (
                    <div className="empty-card">אין כרגע תורים עתידיים.</div>
                  ) : null}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h4>תורים קודמים</h4>
                  <span>{pastAppointments.length} תורים</span>
                </div>
                <div className="timeline">
                  {pastAppointments.map((appointment) => (
                    <article key={appointment.id} className="timeline-item">
                      <div className="time-block">
                        <div>{formatAppointmentDate(appointment.appointment_at)}</div>
                        <div>{formatAppointmentTime(appointment.appointment_at)}</div>
                      </div>
                      <div>
                        <strong>
                          {appointmentPatientById.get(appointment.patient_id)?.full_name ?? "מטופל לא ידוע"}
                        </strong>
                        <div className="chips">
                          <span className="chip">
                            {appointmentPatientById.get(appointment.patient_id)?.discipline ?? "ללא תחום"}
                          </span>
                          <span className="chip warm">{appointment.room ?? "חדר לא הוגדר"}</span>
                          <span className="chip chip-muted">
                            {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל"}
                          </span>
                        </div>
                        <p>{appointment.summary ?? "טרם נכתב סיכום טיפול"}</p>
                        <div className="appointment-actions">
                          {getAppointmentReminderUrl(appointment) ? (
                            <a
                              className="ghost-btn inline-link-btn"
                              href={getAppointmentReminderUrl(appointment)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              שלח תזכורת
                            </a>
                          ) : (
                            <div className="item-meta">חסר מספר טלפון לשליחת תזכורת</div>
                          )}
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => handleSelectPatient(appointment.patient_id)}
                          >
                            פתיחת יומן מטופל
                          </button>
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() => handleEditAppointment(appointment)}
                          >
                            עריכת תור
                          </button>
                          <button
                            className="danger-btn"
                            type="button"
                            onClick={() => handleDeleteAppointment(appointment.id)}
                          >
                            מחיקת תור
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {pastAppointments.length === 0 ? (
                    <div className="empty-card">אין תורים קודמים.</div>
                  ) : null}
                </div>
              </article>
            </div>
          </section>

          <section className={`panel ${activeSection === "team" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">צוות מקצועי</p>
                <h3>עומסים, זמינות והתמחויות</h3>
              </div>
              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  setEditingTherapistId("");
                  setAddTherapistForm(defaultAddTherapistForm);
                  setTherapistSaveStatus("");
                  setShowTherapistDialog(true);
                }}
              >
                הוספת מטפל
              </button>
            </div>
            <div className="team-grid">
              {therapists.map((therapist) => (
                <article key={therapist.id} className="team-card">
                  <div>
                    <strong>{therapist.full_name}</strong>
                    <div className="item-meta">{therapist.profession}</div>
                  </div>
                  <div className="item-meta">{therapist.phone ?? "ללא טלפון"}</div>
                  <div>{therapist.specialty ?? "ללא התמחות מוגדרת"}</div>
                  <div className="chips">
                    <span className="chip">צוות פעיל</span>
                  </div>
                  <div className="appointment-actions">
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => handleEditTherapist(therapist)}
                    >
                      עריכת מטפל
                    </button>
                    <button
                      className="danger-btn"
                      type="button"
                      onClick={() => handleDeleteTherapist(therapist.id)}
                    >
                      מחיקת מטפל
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={`panel ${activeSection === "reports" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">מדדים</p>
                <h3>סיכום</h3>
              </div>
            </div>
            <div className="reports-grid">
              <article className="card">
                <h4>לפי תחום</h4>
                <div className="metric-list">
                  {breakdown.map((item) => (
                    <div key={item.label} className="metric-item">
                      <strong>{item.label}</strong>
                      <div className="item-meta">{item.value}</div>
                    </div>
                  ))}
                </div>
              </article>
              <article className="card">
                <h4>מטופלים הדורשים מעקב</h4>
                <div className="metric-list">
                  {followups.map((item) => (
                    <div key={item.label} className="metric-item">
                      <strong>{item.label}</strong>
                      <div className="item-meta">{item.value}</div>
                    </div>
                  ))}
                  {followups.length === 0 ? (
                    <div className="metric-item">
                      <strong>אין כרגע</strong>
                      <div className="item-meta">כל המטופלים במעקב מסודר</div>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          </section>
        </section>
      </main>

      {showPatientDialog ? (
        <div className="dialog-backdrop" onClick={() => setShowPatientDialog(false)}>
          <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <form className="dialog-form" onSubmit={handleAddPatientSubmit}>
              <div className="dialog-head">
                <h3>הוספת מטופל</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPatientDialog(false)}
                >
                  סגירה
                </button>
              </div>

              <label>
                שם מלא
                <input
                  value={addPatientForm.full_name}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                תחום טיפולי
                <select
                  value={addPatientForm.discipline}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      discipline: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="פיזיותרפיה">פיזיותרפיה</option>
                  <option value="ריפוי בעיסוק">ריפוי בעיסוק</option>
                </select>
              </label>

              <label>
                סטטוס
                <select
                  value={addPatientForm.status}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="חדש">חדש</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="מעקב">מעקב</option>
                </select>
              </label>

              <label>
                טלפון
                <input
                  value={addPatientForm.phone}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="למשל: 0501234567"
                />
              </label>

              <label>
                אבחנה
                <textarea
                  rows={3}
                  value={addPatientForm.diagnosis}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      diagnosis: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                יעד טיפולי
                <textarea
                  rows={3}
                  value={addPatientForm.treatment_goal}
                  onChange={(event) =>
                    setAddPatientForm((current) => ({
                      ...current,
                      treatment_goal: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className="dialog-actions">
                <button className="primary-btn" type="submit" disabled={isAddingPatient}>
                  {isAddingPatient ? "שומר..." : "שמירת מטופל"}
                </button>
                <div className="item-meta">{patientSaveStatus}</div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showTherapistDialog ? (
        <div className="dialog-backdrop" onClick={() => setShowTherapistDialog(false)}>
          <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <form className="dialog-form" onSubmit={handleAddTherapistSubmit}>
              <div className="dialog-head">
                <h3>{editingTherapistId ? "עריכת מטפל" : "הוספת מטפל"}</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setShowTherapistDialog(false);
                    setEditingTherapistId("");
                    setAddTherapistForm(defaultAddTherapistForm);
                    setTherapistSaveStatus("");
                  }}
                >
                  סגירה
                </button>
              </div>

              <label>
                שם מלא
                <input
                  value={addTherapistForm.full_name}
                  onChange={(event) =>
                    setAddTherapistForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                מקצוע
                <select
                  value={addTherapistForm.profession}
                  onChange={(event) =>
                    setAddTherapistForm((current) => ({
                      ...current,
                      profession: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="פיזיותרפיה">פיזיותרפיה</option>
                  <option value="ריפוי בעיסוק">ריפוי בעיסוק</option>
                </select>
              </label>

              <label>
                טלפון
                <input
                  value={addTherapistForm.phone}
                  onChange={(event) =>
                    setAddTherapistForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="למשל: 0501234567"
                />
              </label>

              <label>
                התמחות
                <textarea
                  rows={3}
                  value={addTherapistForm.specialty}
                  onChange={(event) =>
                    setAddTherapistForm((current) => ({
                      ...current,
                      specialty: event.target.value,
                    }))
                  }
                  placeholder="למשל: שיקום אורתופדי, ויסות חושי"
                />
              </label>

              <div className="dialog-actions">
                <button className="primary-btn" type="submit" disabled={isAddingTherapist}>
                  {isAddingTherapist ? "שומר..." : editingTherapistId ? "שמירת שינויים" : "שמירת מטפל"}
                </button>
                <div className="item-meta">{therapistSaveStatus}</div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showJournalDialog && selectedPatient ? (
        <div className="dialog-backdrop" onClick={() => setShowJournalDialog(false)}>
          <div
            className="dialog-card journal-dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-form">
              <div className="dialog-head">
                <div>
                  <h3>עריכת יומן טיפול</h3>
                  <div className="item-meta">{selectedPatient.full_name}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowJournalDialog(false)}
                >
                  סגירה
                </button>
              </div>

              <div className="patient-summary-grid">
                <div className="summary-card">
                  <span>מטופל</span>
                  <strong>{selectedPatient.full_name}</strong>
                  <div className="chips">
                    <span className="chip">{selectedPatient.discipline}</span>
                    <span className="chip warm">{selectedPatient.status}</span>
                  </div>
                </div>
                <div className="summary-card">
                  <span>מטפל אחראי</span>
                  <strong>
                    {therapistNameById.get(selectedPatient.therapist_id ?? "") ?? "טרם שובץ"}
                  </strong>
                  <div className="item-meta">מטפל אחראי</div>
                </div>
                <div className="summary-card">
                  <span>התור הבא</span>
                  <strong>
                    {nextAppointmentForSelectedPatient
                      ? `${formatAppointmentDate(nextAppointmentForSelectedPatient.appointment_at)} | ${formatAppointmentTime(nextAppointmentForSelectedPatient.appointment_at)}`
                      : "עדיין לא נקבע"}
                  </strong>
                  <button
                    className="ghost-btn summary-action"
                    type="button"
                    onClick={() => {
                      setShowJournalDialog(false);
                      handleCreateAppointmentForPatient(selectedPatient.id);
                    }}
                  >
                    קביעת טיפול
                  </button>
                </div>
              </div>

              <form className="journal-form" onSubmit={handleJournalSubmit}>
                <label>
                  סטטוס
                  <select
                    value={journalForm.status}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="חדש">חדש</option>
                    <option value="בטיפול">בטיפול</option>
                    <option value="מעקב">מעקב</option>
                  </select>
                </label>

                <label>
                  טלפון מטופל
                  <input
                    value={journalForm.phone}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="למשל: 0501234567"
                  />
                </label>

                <div className="smart-template-card">
                  <div className="card-head">
                    <div>
                      <strong>תבנית תיעוד חכמה</strong>
                      <div className="item-meta">{activeJournalTemplate.description}</div>
                    </div>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={handleGenerateStructuredSummary}
                    >
                      בניית סיכום אוטומטי
                    </button>
                  </div>

                  <label className="inline-field">
                    סוג תבנית
                    <select
                      value={journalForm.templateKey}
                      onChange={(event) => handleJournalTemplateChange(event.target.value)}
                    >
                      {journalTemplates
                        .filter((template) => template.disciplines.includes(selectedPatient.discipline))
                        .map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="smart-template-grid">
                    {activeJournalTemplate.sections.map((section) => (
                      <label key={section.key} className="smart-template-field">
                        {section.label}
                        <textarea
                          rows={3}
                          value={journalForm.templateAnswers[section.key] ?? ""}
                          onChange={(event) =>
                            handleJournalTemplateAnswerChange(section.key, event.target.value)
                          }
                          placeholder={section.placeholder}
                        />
                        {section.suggestions?.length ? (
                          <div className="suggestion-chips">
                            {section.suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                className="chip-action"
                                type="button"
                                onClick={() =>
                                  handleJournalSuggestionInsert(section.key, suggestion)
                                }
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="smart-template-card">
                  <div className="card-head">
                    <div>
                      <strong>בדיקת מוכנות לתהליך</strong>
                      <div className="item-meta">תמונת מצב מהירה לפני שממשיכים טיפול</div>
                    </div>
                  </div>

                  <div className="readiness-grid">
                    {selectedPatientReadiness.map((item) => (
                      <article
                        key={item.label}
                        className={`readiness-item ${item.done ? "done" : "missing"}`}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </article>
                    ))}
                  </div>
                </div>

                <label>
                  אבחנה
                  <textarea
                    rows={3}
                    value={journalForm.diagnosis}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        diagnosis: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  יעד טיפולי
                  <textarea
                    rows={3}
                    value={journalForm.goal}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        goal: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  סיכום מפגש אחרון
                  <textarea
                    rows={5}
                    value={journalForm.latestNote}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        latestNote: event.target.value,
                      }))
                    }
                    placeholder="אפשר לעדכן כאן את סיכום המפגש האחרון"
                  />
                </label>

                <label>
                  המלצות ותרגול לבית
                  <textarea
                    rows={3}
                    value={journalForm.homeProgram}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        homeProgram: event.target.value,
                      }))
                    }
                    placeholder="תרגול בית, המלצות והנחיות"
                  />
                </label>

                <div className="journal-actions">
                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={isSavingJournal || !clinicalNotesEnabled}
                  >
                    {isSavingJournal ? "שומר..." : "שמירת יומן"}
                  </button>
                  {appointmentManagementEnabled ? (
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => {
                        setShowJournalDialog(false);
                        handleCreateAppointmentForPatient(selectedPatient.id);
                      }}
                    >
                      קביעת טיפול המשך
                    </button>
                  ) : null}
                  <div className="item-meta">{journalSaveStatus}</div>
                </div>
              </form>

              <div className="journal-history">
                <div className="card-head">
                  <h4>היסטוריית יומן</h4>
                  <span>שלוש הרשומות האחרונות</span>
                </div>
                <div className="stack-list">
                  {journalEntries.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="list-item">
                      <strong>{formatJournalDate(entry.entry_date)}</strong>
                      <div className="preserve-lines">{entry.content}</div>
                      {entry.home_program ? (
                        <div className="item-meta preserve-lines">
                          תרגול בית: {entry.home_program}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {journalEntries.length === 0 ? (
                    <div className="list-item">
                      <strong>עדיין אין רשומות</strong>
                      <div>ברגע שתשמור סיכום טיפול, הוא יופיע כאן.</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAppointmentDialog ? (
        <div className="dialog-backdrop" onClick={() => setShowAppointmentDialog(false)}>
          <div
            className="dialog-card journal-dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-form">
              <div className="dialog-head">
                <div>
                  <h3>{editingAppointmentId ? "עריכת תור" : "קביעת טיפול חדש"}</h3>
                  <div className="item-meta">
                    {editingAppointmentId ? "עדכון פרטי התור" : "פרטי התור"}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowAppointmentDialog(false)}
                >
                  סגירה
                </button>
              </div>

              {appointmentForm.patient_id ? (
                <div className="appointment-context">
                  <div className="summary-card">
                    <span>מטופל</span>
                    <strong>
                      {appointmentPatientById.get(appointmentForm.patient_id)?.full_name ?? "לא נבחר"}
                    </strong>
                    <div className="item-meta">
                      {appointmentPatientById.get(appointmentForm.patient_id)?.discipline ?? "ללא תחום"}
                    </div>
                  </div>
                  <div className="summary-card">
                    <span>מטפל בפגישה</span>
                    <strong>
                      {therapistNameById.get(appointmentForm.therapist_id) ??
                        therapistNameById.get(
                          appointmentPatientById.get(appointmentForm.patient_id)?.therapist_id ?? "",
                        ) ??
                        "שיבוץ אוטומטי"}
                    </strong>
                    <div className="item-meta">המטפל בתור</div>
                  </div>
                </div>
              ) : null}

              <form className="journal-form" onSubmit={handleAppointmentSubmit}>
                <label>
                  מטופל
                  <select
                    value={appointmentForm.patient_id}
                    onChange={(event) => {
                      const patient = patients.find((item) => item.id === event.target.value);
                      setAppointmentForm((current) => ({
                        ...current,
                        patient_id: event.target.value,
                        therapist_id: patient?.therapist_id ?? "",
                      }));
                    }}
                    required
                  >
                    <option value="">בחר מטופל</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  מטפל
                  <select
                    value={appointmentForm.therapist_id}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        therapist_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">שיוך אוטומטי לפי המטופל</option>
                    {therapists.map((therapist) => (
                      <option key={therapist.id} value={therapist.id}>
                        {therapist.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  תאריך
                  <div className="select-row">
                    <select
                      value={appointmentForm.appointment_day}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_day: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">יום</option>
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      value={appointmentForm.appointment_month}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_month: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">חודש</option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      value={appointmentForm.appointment_year}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_year: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">שנה</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label>
                  שעה
                  <div className="select-row">
                    <select
                      value={appointmentForm.appointment_hour}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_hour: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">שעה</option>
                      {hourOptions.map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <select
                      value={appointmentForm.appointment_minute}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_minute: event.target.value,
                        }))
                      }
                      required
                    >
                      {minuteOptions.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label>
                  חדר טיפול
                  <input
                    type="text"
                    value={appointmentForm.room}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        room: event.target.value,
                      }))
                    }
                    placeholder="למשל: חדר 2"
                  />
                </label>

                <label>
                  הערת טיפול
                  <textarea
                    rows={3}
                    value={appointmentForm.summary}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="מטרת המפגש או הערה לקראת הטיפול"
                  />
                </label>

                <div className="journal-actions">
                  <button className="primary-btn" type="submit" disabled={isSavingAppointment}>
                    {isSavingAppointment ? "שומר..." : editingAppointmentId ? "שמירת שינויים" : "קביעת טיפול"}
                  </button>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => {
                      setEditingAppointmentId("");
                      setAppointmentForm({
                        ...defaultAppointmentForm,
                        patient_id: selectedPatient?.id ?? "",
                        therapist_id: selectedPatient?.therapist_id ?? "",
                      });
                      setAppointmentSaveStatus("");
                      setShowAppointmentDialog(false);
                    }}
                  >
                    ביטול
                  </button>
                  <div className="item-meta">{appointmentSaveStatus}</div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
