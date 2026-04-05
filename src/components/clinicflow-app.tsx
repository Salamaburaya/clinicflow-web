"use client";

import Link from "next/link";
import {
  type AccessContext,
  type AppRole,
  type AppSection,
  canManageBilling,
  canEditClinicalNotes,
  canManageAppointments,
  canManagePatients,
  getRoleLabel,
  getVisibleSections,
} from "@/lib/clinicflow-access";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { PatientProfileWorkspace } from "@/components/patient-profile-workspace";
import { useEffect, useMemo, useState } from "react";

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
  settlement?: string | null;
  address?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  title?: string | null;
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

type PaymentEntry = {
  id: string;
  patient_id: string;
  created_at: string;
  payment_date: string;
  amount: number;
  method: string;
  status: "completed" | "pending" | "refunded";
  category: string;
  note: string | null;
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
  initialPaymentEntries: PaymentEntry[];
  accessContext: AccessContext;
  initialSection?: AppSection;
  displayMode?: "full" | "patients" | "patient-record";
  focusedPatientId?: string;
};

type AddPatientForm = {
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string;
  treatment_goal: string;
  phone: string;
  email: string;
  city: string;
  settlement: string;
  address: string;
  birth_date: string;
  gender: string;
  title: string;
  occupation: string;
  referring_source: string;
  communication_preference: string;
  insurance_provider: string;
  coverage_track: string;
  attendance_risk: string;
  preferred_days: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  allergies: string;
  medications: string;
  medical_background: string;
  intake_summary: string;
  functional_status: string;
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

type AddPaymentInput = {
  patientId: string;
  amount: number;
  method: string;
  category: string;
  note: string;
};

type UpdatePaymentInput = {
  paymentId: string;
  patientId: string;
  amount: number;
  method: string;
  category: string;
  note: string;
};

type DeletePaymentInput = {
  paymentId: string;
  patientId: string;
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
  email: "",
  city: "",
  settlement: "",
  address: "",
  birth_date: "",
  gender: "",
  title: "",
  occupation: "",
  referring_source: "",
  communication_preference: "",
  insurance_provider: "",
  coverage_track: "",
  attendance_risk: "",
  preferred_days: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  allergies: "",
  medications: "",
  medical_background: "",
  intake_summary: "",
  functional_status: "",
};

function buildPatientForm(patient?: Patient | null): AddPatientForm {
  if (!patient) {
    return defaultAddPatientForm;
  }

  return {
    full_name: patient.full_name,
    discipline: patient.discipline,
    status: patient.status,
    diagnosis: patient.diagnosis ?? "",
    treatment_goal: patient.treatment_goal ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    city: patient.city ?? "",
    settlement: patient.settlement ?? "",
    address: patient.address ?? "",
    birth_date: patient.birth_date ?? "",
    gender: patient.gender ?? "",
    title: patient.title ?? "",
    occupation: patient.occupation ?? "",
    referring_source: patient.referring_source ?? "",
    communication_preference: patient.communication_preference ?? "",
    insurance_provider: patient.insurance_provider ?? "",
    coverage_track: patient.coverage_track ?? "",
    attendance_risk: patient.attendance_risk ?? "",
    preferred_days: patient.preferred_days ?? "",
    emergency_contact_name: patient.emergency_contact_name ?? "",
    emergency_contact_phone: patient.emergency_contact_phone ?? "",
    allergies: patient.allergies ?? "",
    medications: patient.medications ?? "",
    medical_background: patient.medical_background ?? "",
    intake_summary: patient.intake_summary ?? "",
    functional_status: patient.functional_status ?? "",
  };
}

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
const localWorkspaceStateStorageKey = "clinicflow-local-workspace-v2";
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

async function runClinicMutation<T>(
  payload: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch("/api/clinicflow/mutate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { ok?: boolean; error?: string } & T;

    if (!response.ok || !result.ok) {
      return {
        error: result.error ?? "Clinic mutation failed",
      };
    }

    return { data: result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Clinic mutation failed",
    };
  }
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
  initialPaymentEntries,
  accessContext,
  initialSection,
  displayMode = "full",
  focusedPatientId,
}: ClinicFlowAppProps) {
  const initialSelectedPatientId =
    (focusedPatientId ?? initialPatients[0]?.id) ?? "";
  const [currentRole, setCurrentRole] = useState<AppRole>(accessContext.role);
  const visibleSections = useMemo(
    () => getVisibleSections(currentRole),
    [currentRole],
  );
  const navigationSections = useMemo(
    () =>
      displayMode === "full"
        ? visibleSections
        : [
            {
              key: "patients" as AppSection,
              label: displayMode === "patient-record" ? "תיק מטופל" : "מטופלים",
            },
          ],
    [displayMode, visibleSections],
  );
  const defaultSection = useMemo<AppSection>(
    () =>
      initialSection
      && navigationSections.some((section) => section.key === initialSection)
        ? initialSection
        : navigationSections[0]?.key ?? "dashboard",
    [initialSection, navigationSections],
  );
  const [activeSection, setActiveSection] = useState<AppSection>(
    defaultSection,
  );
  const resolvedActiveSection = navigationSections.some(
    (section) => section.key === activeSection,
  )
    ? activeSection
    : defaultSection;
  const [therapists, setTherapists] = useState(() => initialTherapists);
  const [patients, setPatients] = useState(() => initialPatients);
  const [appointments, setAppointments] = useState(() => initialAppointments);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>(
    () => initialPaymentEntries,
  );
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialSelectedPatientId,
  );
  const effectiveSelectedPatientId = focusedPatientId ?? selectedPatientId;
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showPatientDialog, setShowPatientDialog] = useState(false);
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showTherapistDialog, setShowTherapistDialog] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState("");
  const [editingTherapistId, setEditingTherapistId] = useState("");
  const [reminderNotices, setReminderNotices] = useState<ReminderNotice[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const storedNotices = window.localStorage.getItem(reminderItemsStorageKey);
    if (!storedNotices) {
      return [];
    }

    try {
      return mergeReminderNotices(
        [],
        (JSON.parse(storedNotices) as ReminderNotice[])
          .map(normalizeReminderNotice)
          .filter(isPatientReminderNotice),
      );
    } catch {
      window.localStorage.removeItem(reminderItemsStorageKey);
      return [];
    }
  });
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
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      initialPatients.map((patient) => [patient.id, patient.status]),
    ),
  );
  const initialFocusedPatient =
    initialPatients.find((patient) => patient.id === initialSelectedPatientId)
    ?? initialPatients[0];
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>({
    ...defaultAppointmentForm,
    patient_id: initialSelectedPatientId,
    therapist_id: initialFocusedPatient?.therapist_id ?? "",
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

  const isPatientsDirectoryMode = displayMode === "patients";
  const isPatientRecordMode = displayMode === "patient-record";
  const selectedPatient = isPatientRecordMode
    ? patients.find((patient) => patient.id === effectiveSelectedPatientId)
    : patients.find((patient) => patient.id === effectiveSelectedPatientId) ?? patients[0];
  const isWaitingForFocusedPatient = false;
  const isMissingFocusedPatient =
    isPatientRecordMode
    && Boolean(focusedPatientId)
    && !selectedPatient;
  const selectedPatientIndex = selectedPatient
    ? patients.findIndex((patient) => patient.id === selectedPatient.id)
    : -1;
  const previousPatient = selectedPatientIndex > 0
    ? patients[selectedPatientIndex - 1]
    : undefined;
  const nextPatient = selectedPatientIndex >= 0 && selectedPatientIndex < patients.length - 1
    ? patients[selectedPatientIndex + 1]
    : undefined;

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
  const selectedPatientPayments = paymentEntries
    .filter((entry) => entry.patient_id === selectedPatient?.id)
    .sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
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
  const billingManagementEnabled = canManageBilling(currentRole);

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
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(localWorkspaceStateStorageKey);
  }, []);

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

    persistReminderNoticesToStorage(reminderNotices);
  }, [reminderNotices]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    const patientId = selectedPatient.id;

    const loadEntries = async () => {
      try {
        const response = await fetch(
          `/api/clinicflow/patient-record?patientId=${encodeURIComponent(patientId)}`,
        );

        if (!response.ok) {
          setJournalSaveStatus("לא ניתן לטעון את תיק המטופל מהשרת כרגע");
          return;
        }

        const result = (await response.json()) as {
          ok?: boolean;
          journalEntries?: JournalEntry[];
          paymentEntries?: PaymentEntry[];
          errors?: {
            journalEntries?: string | null;
            paymentEntries?: string | null;
          };
        };

        if (!result.ok) {
          setJournalSaveStatus("לא ניתן לטעון את תיק המטופל מהשרת כרגע");
          return;
        }

        if (result.errors?.journalEntries) {
          setJournalSaveStatus("לא ניתן לטעון את היסטוריית היומן כרגע");
        } else {
          setJournalEntries(result.journalEntries ?? []);
        }

        if (result.paymentEntries) {
          setPaymentEntries((current) => {
            const otherPatientsEntries = current.filter(
              (entry) => entry.patient_id !== patientId,
            );

            return [...result.paymentEntries!, ...otherPatientsEntries].sort(
              (a, b) =>
                new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
            );
          });
        }
      } catch {
        setJournalSaveStatus("לא ניתן לטעון את תיק המטופל מהשרת כרגע");
        return;
      }
    };

    void loadEntries();
  }, [selectedPatient]);

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

    const patientPayload = {
      full_name: addPatientForm.full_name.trim(),
      discipline: addPatientForm.discipline,
      status: addPatientForm.status,
      diagnosis: addPatientForm.diagnosis.trim() || null,
      treatment_goal: addPatientForm.treatment_goal.trim() || null,
      therapist_id: therapistId,
      phone: addPatientForm.phone.trim() || null,
      email: addPatientForm.email.trim() || null,
      city: addPatientForm.city.trim() || null,
      settlement: addPatientForm.settlement.trim() || null,
      address: addPatientForm.address.trim() || null,
      birth_date: addPatientForm.birth_date || null,
      gender: addPatientForm.gender.trim() || null,
      title: addPatientForm.title.trim() || null,
      occupation: addPatientForm.occupation.trim() || null,
      referring_source: addPatientForm.referring_source.trim() || null,
      communication_preference: addPatientForm.communication_preference.trim() || null,
      insurance_provider: addPatientForm.insurance_provider.trim() || null,
      coverage_track: addPatientForm.coverage_track.trim() || null,
      attendance_risk: addPatientForm.attendance_risk.trim() || null,
      preferred_days: addPatientForm.preferred_days.trim() || null,
      emergency_contact_name: addPatientForm.emergency_contact_name.trim() || null,
      emergency_contact_phone: addPatientForm.emergency_contact_phone.trim() || null,
      allergies: addPatientForm.allergies.trim() || null,
      medications: addPatientForm.medications.trim() || null,
      medical_background: addPatientForm.medical_background.trim() || null,
      intake_summary: addPatientForm.intake_summary.trim() || null,
      functional_status: addPatientForm.functional_status.trim() || null,
    };

    const { data: mutationResult, error } = await runClinicMutation<{ patient: Patient }>({
      action: "savePatient",
      editingPatientId: editingPatientId || undefined,
      payload: patientPayload,
    });
    const data = mutationResult?.patient;
    if (error || !data) {
      setIsAddingPatient(false);
      setPatientSaveStatus("לא ניתן לשמור את המטופל כרגע. הפרטים לא נשמרו בשרת.");
      return;
    }

    const savedPatient = data as Patient;

    const nextPatients = editingPatientId
      ? patients.map((patient) => (patient.id === editingPatientId ? {
          ...patient,
          ...savedPatient,
          payment_balance: savedPatient.payment_balance ?? patient.payment_balance ?? 0,
        } : patient))
      : [savedPatient, ...patients];

    setPatients(nextPatients);
    setStatusDrafts((current) => ({
      ...current,
      [savedPatient.id]: savedPatient.status,
    }));
    setSelectedPatientId(savedPatient.id);
    setAppointmentForm((current) => ({
      ...current,
      patient_id: savedPatient.id,
      therapist_id: savedPatient.therapist_id ?? "",
    }));
    setAddPatientForm(defaultAddPatientForm);
    setEditingPatientId("");
    setShowPatientDialog(false);
    setActiveSection("patients");
    setIsAddingPatient(false);
    setPatientSaveStatus(
      editingPatientId ? "פרטי המטופל נשמרו בהצלחה" : "המטופל נשמר בהצלחה",
    );
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

    const { data: mutationResult, error } = await runClinicMutation<{ therapist: Therapist }>({
      action: "saveTherapist",
      editingTherapistId: editingTherapistId || undefined,
      payload,
    });
    const data = mutationResult?.therapist;
    if (error || !data) {
      setIsAddingTherapist(false);
      setTherapistSaveStatus("לא ניתן לשמור את המטפל כרגע. הפרטים לא נשמרו בשרת.");
      return;
    }

    const nextTherapist = data as Therapist;
    const nextTherapists = editingTherapistId
      ? therapists.map((therapist) =>
          therapist.id === nextTherapist.id ? nextTherapist : therapist,
        )
      : [...therapists, nextTherapist];

    setTherapists(nextTherapists);
    setAddTherapistForm(defaultAddTherapistForm);
    setShowTherapistDialog(false);
    setIsAddingTherapist(false);
    setEditingTherapistId("");
    setTherapistSaveStatus(
      editingTherapistId ? "פרטי המטפל נשמרו בהצלחה" : "המטפל נשמר בהצלחה",
    );
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

  function closePatientDialog() {
    setShowPatientDialog(false);
    setEditingPatientId("");
    setAddPatientForm(defaultAddPatientForm);
    setPatientSaveStatus("");
  }

  function openAddPatientDialog() {
    setEditingPatientId("");
    setAddPatientForm(defaultAddPatientForm);
    setPatientSaveStatus("");
    setShowPatientDialog(true);
  }

  function handleEditPatient(patient: Patient) {
    setEditingPatientId(patient.id);
    setAddPatientForm(buildPatientForm(patient));
    setPatientSaveStatus("");
    setShowPatientDialog(true);
  }

  async function handleDeleteTherapist(therapistId: string) {
    const therapistName =
      therapists.find((therapist) => therapist.id === therapistId)?.full_name ?? "המטפל";
    const confirmed = window.confirm(`למחוק את ${therapistName}?`);
    if (!confirmed) {
      return;
    }

    setDeleteStatus("");
    const { error } = await runClinicMutation({
      action: "deleteTherapist",
      therapistId,
    });
    if (error) {
      setDeleteStatus("לא ניתן למחוק את המטפל כרגע. המחיקה לא נשמרה בשרת.");
      return;
    }

    const nextTherapists = therapists.filter((therapist) => therapist.id !== therapistId);
    const nextPatients = patients.map((patient) =>
      patient.therapist_id === therapistId
        ? { ...patient, therapist_id: null }
        : patient,
    );

    setTherapists(nextTherapists);
    setPatients(nextPatients);
    setDeleteStatus("המטפל נמחק בהצלחה");
  }

  async function handleJournalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      return;
    }

    setIsSavingJournal(true);
    setJournalSaveStatus("");

    const patientPayload = {
      status: journalForm.status,
      diagnosis: journalForm.diagnosis.trim() || null,
      treatment_goal: journalForm.goal.trim() || null,
      phone: journalForm.phone.trim() || null,
    };

    const noteContent = buildStructuredJournalNote(
      journalForm,
      selectedPatient.discipline,
    ).trim();
    const journalPayload = noteContent
      ? {
          patient_id: selectedPatient.id,
          therapist_id: selectedPatient.therapist_id,
          content: noteContent,
          home_program: journalForm.homeProgram.trim() || null,
        }
      : null;

    const { data: mutationResult, error: mutationError } = await runClinicMutation<{
      patient: Patient;
      journalEntry: JournalEntry | null;
    }>({
      action: "saveJournal",
      patientId: selectedPatient.id,
      patientPayload,
      journalPayload,
    });
    const updatedPatient = mutationResult?.patient;
    if (mutationError || !updatedPatient) {
      setIsSavingJournal(false);
      setJournalSaveStatus("לא ניתן לשמור את היומן כרגע. התיעוד לא נשמר בשרת.");
      return;
    }

    const insertedEntry = mutationResult?.journalEntry ?? null;
    const nextPatient = updatedPatient as Patient;

    const nextPatients = patients.map((patient) =>
      patient.id === nextPatient.id ? nextPatient : patient,
    );
    const nextJournalEntries = insertedEntry
      ? [insertedEntry as JournalEntry, ...journalEntries]
      : journalEntries;

    setPatients(nextPatients);
    setStatusDrafts((current) => ({
      ...current,
      [nextPatient.id]: nextPatient.status,
    }));
    setJournalForm(buildJournalForm(nextPatient));
    if (insertedEntry) {
      setJournalEntries(nextJournalEntries);
    }
    setIsSavingJournal(false);
    setJournalSaveStatus(
      insertedEntry && noteContent ? "היומן נשמר בהצלחה" : "תיק המטופל עודכן בהצלחה",
    );
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

    const { data: mutationResult, error } = await runClinicMutation<{ appointment: Appointment }>({
      action: "saveAppointment",
      editingAppointmentId: editingAppointmentId || undefined,
      payload,
    });
    const data = mutationResult?.appointment;
    if (error || !data) {
      setIsSavingAppointment(false);
      setAppointmentSaveStatus("לא ניתן לשמור את התור כרגע. השינוי לא נשמר בשרת.");
      return;
    }

    const nextAppointment = data as Appointment;
    const nextAppointments = appointments
      .filter((appointment) => appointment.id !== nextAppointment.id)
      .concat(nextAppointment)
      .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));

    setAppointments(nextAppointments);

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
    setAppointmentSaveStatus(
      editingAppointmentId ? "התור עודכן בהצלחה" : "הטיפול נקבע בהצלחה",
    );
    setActiveSection(isPatientRecordMode ? "patients" : "appointments");
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
    setActiveSection(isPatientRecordMode ? "patients" : "appointments");
  }

  async function handleQuickStatusSave(patientId: string) {
    const nextStatus = statusDrafts[patientId];
    if (!nextStatus) {
      return;
    }

    const { data: mutationResult, error } = await runClinicMutation<{ patient: Patient }>({
      action: "updatePatientStatus",
      patientId,
      status: nextStatus,
    });
    const data = mutationResult?.patient;
    if (error || !data) {
      setDeleteStatus("לא ניתן לעדכן את סטטוס המטופל כרגע. השינוי לא נשמר בשרת.");
      return;
    }

    const updatedPatient = data as Patient;
    const nextPatients = patients.map((patient) =>
      patient.id === updatedPatient.id ? updatedPatient : patient,
    );

    setPatients(nextPatients);
    if (effectiveSelectedPatientId === updatedPatient.id) {
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
    const { error } = await runClinicMutation({
      action: "deleteAppointment",
      appointmentId,
    });
    if (error) {
      setDeleteStatus("לא ניתן למחוק את התור כרגע. המחיקה לא נשמרה בשרת.");
      return;
    }

    const nextAppointments = appointments.filter(
      (appointment) => appointment.id !== appointmentId,
    );

    setAppointments(nextAppointments);
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
    const { error } = await runClinicMutation({
      action: "deletePatient",
      patientId,
    });
    if (error) {
      setDeleteStatus("לא ניתן למחוק את המטופל כרגע. המחיקה לא נשמרה בשרת.");
      return;
    }

    const nextPatients = patients.filter((patient) => patient.id !== patientId);
    const nextAppointments = appointments.filter(
      (appointment) => appointment.patient_id !== patientId,
    );
    const nextPaymentEntries = paymentEntries.filter(
      (entry) => entry.patient_id !== patientId,
    );
    const nextJournalEntries = journalEntries.filter(
      (entry) => entry.patient_id !== patientId,
    );
    const nextStatusDrafts = Object.fromEntries(
      Object.entries(statusDrafts).filter(([key]) => key !== patientId),
    );

    setPatients(nextPatients);
    setAppointments(nextAppointments);
    setPaymentEntries(nextPaymentEntries);
    setJournalEntries(nextJournalEntries);
    setStatusDrafts(nextStatusDrafts);
    setSelectedPatientId(nextPatients[0]?.id ?? "");

    if (isPatientRecordMode && typeof window !== "undefined") {
      window.location.assign("/patients");
      return;
    }

    setDeleteStatus("המטופל נמחק בהצלחה");
  }

  function handleSelectPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setJournalForm(buildJournalForm(patient));
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
    setJournalForm(buildJournalForm(patient));
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
    setActiveSection(isPatientRecordMode ? "patients" : "appointments");
  }

  function getPatientRecordHref(patientId: string) {
    return `/patients/${encodeURIComponent(patientId)}`;
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

  function handleJournalTemplateChange(templateKey: string) {
    const nextTemplate = getJournalTemplate(templateKey, selectedPatient?.discipline);
    setJournalForm((current) => ({
      ...current,
      templateKey: nextTemplate.key,
      templateAnswers: createTemplateAnswers(nextTemplate, current.templateAnswers),
    }));
  }

  async function handleAddPayment({ patientId, amount, method, category, note }: AddPaymentInput) {
    const normalizedAmount = Number(amount);

    if (!patientId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return;
    }

    const { data: mutationResult, error } = await runClinicMutation<{
      paymentEntry: PaymentEntry;
      patient: Patient;
    }>({
      action: "savePayment",
      patientId,
      amount: normalizedAmount,
      method,
      category,
      note,
    });
    const savedPaymentEntry = mutationResult?.paymentEntry;
    const savedPatient = mutationResult?.patient;
    if (error || !savedPaymentEntry || !savedPatient) {
      setDeleteStatus("לא ניתן לשמור את התשלום כרגע. התשלום לא נשמר בשרת.");
      return;
    }

    const nextPaymentEntries = [savedPaymentEntry, ...paymentEntries.filter((entry) => entry.id !== savedPaymentEntry.id)];
    const nextPatients = patients.map((patient) =>
      patient.id === patientId
        ? savedPatient
        : patient,
    );

    setPaymentEntries(nextPaymentEntries);
    setPatients(nextPatients);
    setDeleteStatus("התשלום נשמר בהצלחה");
  }

  async function handleUpdatePayment({
    paymentId,
    patientId,
    amount,
    method,
    category,
    note,
  }: UpdatePaymentInput) {
    const normalizedAmount = Number(amount);

    if (!paymentId || !patientId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return;
    }

    const existingPayment = paymentEntries.find((entry) => entry.id === paymentId);

    if (!existingPayment) {
      return;
    }

    const { data: mutationResult, error } = await runClinicMutation<{
      paymentEntry: PaymentEntry;
      patient: Patient;
    }>({
      action: "updatePayment",
      paymentId,
      patientId,
      amount: normalizedAmount,
      method,
      category,
      note,
    });
    const nextPaymentEntry = mutationResult?.paymentEntry;
    const updatedPatient = mutationResult?.patient;
    if (error || !nextPaymentEntry || !updatedPatient) {
      setDeleteStatus("לא ניתן לעדכן את התשלום כרגע. השינוי לא נשמר בשרת.");
      return;
    }

    const nextPaymentEntries = paymentEntries.map((entry) =>
      entry.id === paymentId
        ? nextPaymentEntry
        : entry,
    );

    const nextPatients = patients.map((patient) =>
      patient.id === patientId
        ? updatedPatient
        : patient,
    );

    setPaymentEntries(nextPaymentEntries);
    setPatients(nextPatients);
    setDeleteStatus("התשלום עודכן בהצלחה");
  }

  async function handleDeletePayment({ paymentId, patientId }: DeletePaymentInput) {
    if (!paymentId || !patientId) {
      return;
    }

    const existingPayment = paymentEntries.find((entry) => entry.id === paymentId);

    if (!existingPayment) {
      return;
    }

    const { data: mutationResult, error } = await runClinicMutation<{
      patient: Patient;
    }>({
      action: "deletePayment",
      paymentId,
      patientId,
    });
    const updatedPatient = mutationResult?.patient;
    if (error || !updatedPatient) {
      setDeleteStatus("לא ניתן למחוק את התשלום כרגע. המחיקה לא נשמרה בשרת.");
      return;
    }

    const nextPaymentEntries = paymentEntries.filter((entry) => entry.id !== paymentId);
    const nextPatients = patients.map((patient) =>
      patient.id === patientId
        ? updatedPatient
        : patient,
    );

    setPaymentEntries(nextPaymentEntries);
    setPatients(nextPatients);
    setDeleteStatus("התשלום נמחק בהצלחה");
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
      <main className={`page-shell page-shell-${displayMode}`}>
        <section className={`content content-${displayMode}`}>
          <header className="topbar">
            <div className="topbar-copy">
              <p className="eyebrow">ClinicFlow</p>
              <h1>מערכת המכון</h1>
              <span className="topbar-meta">
                {accessContext.clinicName} | {getRoleLabel(currentRole)}
              </span>
            </div>

            {navigationSections.length > 0 ? (
              <nav className="top-nav">
                {navigationSections.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`nav-link ${resolvedActiveSection === key ? "active" : ""}`}
                    data-section={key}
                    onClick={() => setActiveSection(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ) : null}

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

          {!isPatientRecordMode ? (
            <section className="hero">
              <div>
                <p className="section-tag">
                  {isPatientsDirectoryMode ? "מאגר מטופלים" : "עמוד ראשי"}
                </p>
                <h2>
                  {isPatientsDirectoryMode
                    ? "חיפוש ופתיחת תיקי מטופלים"
                    : "ניהול שוטף של המטופלים והתורים"}
                </h2>
                <p>
                  {isPatientsDirectoryMode
                    ? "כאן עובדים על הרשימה, מחפשים מהר, ופותחים תיק מטופל מלא במסך ייעודי."
                    : "בחר פעולה כדי להוסיף מטופל חדש או לקבוע טיפול."}
                </p>
              </div>
              <div className="hero-actions">
                {patientManagementEnabled ? (
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={openAddPatientDialog}
                  >
                    הוספת מטופל
                  </button>
                ) : null}
                {isPatientsDirectoryMode ? (
                  <Link className="secondary-btn" href="/">
                    חזרה ללוח בקרה
                  </Link>
                ) : appointmentManagementEnabled ? (
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={handleOpenAppointmentDialog}
                  >
                    מעבר ליומן
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className={`panel ${resolvedActiveSection === "dashboard" ? "active" : ""}`}>
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

          <section className={`panel ${resolvedActiveSection === "patients" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">
                  {isPatientRecordMode ? "תיק מטופל" : "מאגר מטופלים"}
                </p>
                <h3>
                  {isPatientRecordMode
                    ? "תיק מטופל מלא"
                    : isPatientsDirectoryMode
                      ? "חיפוש, סינון ופתיחת תיקי מטופלים"
                      : "מטופלים ואפשרויות פעולה"}
                </h3>
              </div>
              {!isPatientRecordMode ? (
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
              ) : (
                <div className="section-tools">
                  <div className="section-summary">
                    {selectedPatient?.discipline ?? "ללא תחום"}
                  </div>
                  <div className="section-summary">
                    {therapistNameById.get(selectedPatient?.therapist_id ?? "") ?? "ללא מטפל"}
                  </div>
                </div>
              )}
            </div>

            {!isPatientRecordMode ? (
              <div className="card patient-directory-callout">
                <div>
                  <strong>
                    {selectedPatient
                      ? `${selectedPatient.full_name} מוכן לפתיחת תיק מלא`
                      : "בחר מטופל מהרשימה כדי לפתוח תיק מלא"}
                  </strong>
                  <div className="item-meta">
                    כשהמאגר גדל, פותחים תיק מטופל במסך ייעודי בלי לגלול לסוף הרשימה.
                  </div>
                </div>
                <div className="patient-directory-actions">
                  {selectedPatient ? (
                    <Link className="primary-btn" href={getPatientRecordHref(selectedPatient.id)}>
                      פתיחת תיק מלא
                    </Link>
                  ) : null}
                  {displayMode === "full" ? (
                    <Link className="ghost-btn inline-link-btn" href="/patients">
                      לעמוד מטופלים מלא
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isPatientRecordMode ? (
              <>
                {isWaitingForFocusedPatient ? (
                  <article className="card patient-route-state-card">
                    <div>
                      <strong>טוען את תיק המטופל...</strong>
                      <div className="item-meta">
                        טוען את התיק ישירות מהשרת.
                      </div>
                    </div>
                    <div className="patient-route-state-actions">
                      <Link className="ghost-btn inline-link-btn" href="/patients">
                        חזרה למאגר המטופלים
                      </Link>
                    </div>
                  </article>
                ) : isMissingFocusedPatient ? (
                  <article className="card patient-route-state-card">
                    <div>
                      <strong>לא מצאנו כרגע את המטופל הזה</strong>
                      <div className="item-meta">
                        ייתכן שהמטופל נמחק, שהקישור ישן, או שהרשומה עדיין לא זמינה בשרת.
                      </div>
                    </div>
                    <div className="patient-route-state-actions">
                      <Link className="primary-btn" href="/patients">
                        חזרה למאגר המטופלים
                      </Link>
                      <Link className="ghost-btn inline-link-btn" href="/">
                        חזרה ללוח הבקרה
                      </Link>
                    </div>
                  </article>
                ) : (
                  <>
                    <div className="card patient-route-toolbar">
                      <div>
                        <strong>{selectedPatient?.full_name ?? "תיק מטופל"}</strong>
                        <div className="item-meta">
                          עבודה על התיק המלא במסך ייעודי בלי תלות בגלילה של רשימת המטופלים.
                        </div>
                      </div>
                      <div className="patient-route-toolbar-actions">
                        <Link className="ghost-btn inline-link-btn" href="/patients">
                          חזרה למאגר המטופלים
                        </Link>
                        {previousPatient ? (
                          <Link
                            className="secondary-btn"
                            href={getPatientRecordHref(previousPatient.id)}
                          >
                            מטופל קודם
                          </Link>
                        ) : null}
                        {nextPatient ? (
                          <Link className="secondary-btn" href={getPatientRecordHref(nextPatient.id)}>
                            מטופל הבא
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <PatientProfileWorkspace
                      patient={selectedPatient}
                      appointments={selectedPatientAppointments}
                      payments={selectedPatientPayments}
                      journalEntries={journalEntries}
                      therapistName={
                        therapistNameById.get(selectedPatient?.therapist_id ?? "") ?? "ללא מטפל"
                      }
                      statusDraft={selectedPatient ? statusDrafts[selectedPatient.id] ?? selectedPatient.status : "חדש"}
                      canManagePatients={patientManagementEnabled}
                      canManageAppointments={appointmentManagementEnabled}
                      canEditClinicalNotes={clinicalNotesEnabled}
                      canManageBilling={billingManagementEnabled}
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
                      onEditPatient={() => {
                        if (!selectedPatient) {
                          return;
                        }
                        handleEditPatient(selectedPatient);
                      }}
                      onAddPayment={({ amount, method, category, note }) => {
                        if (!selectedPatient) {
                          return;
                        }
                        handleAddPayment({
                          patientId: selectedPatient.id,
                          amount,
                          method,
                          category,
                          note,
                        });
                      }}
                      onUpdatePayment={({ paymentId, amount, method, category, note }) => {
                        if (!selectedPatient) {
                          return;
                        }
                        handleUpdatePayment({
                          paymentId,
                          patientId: selectedPatient.id,
                          amount,
                          method,
                          category,
                          note,
                        });
                      }}
                      onDeletePayment={(paymentId) => {
                        if (!selectedPatient) {
                          return;
                        }
                        handleDeletePayment({
                          paymentId,
                          patientId: selectedPatient.id,
                        });
                      }}
                      formatAppointmentDate={formatAppointmentDate}
                      formatAppointmentTime={formatAppointmentTime}
                      formatJournalDate={formatJournalDate}
                    />
                  </>
                )}
              </>
            ) : (
              <>
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
                        <Link
                          className="primary-btn"
                          href={getPatientRecordHref(patient.id)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          פתיחת תיק מלא
                        </Link>
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
                  {filteredPatients.length === 0 ? (
                    <div className="empty-card patient-list-empty-card">
                      אין כרגע מטופלים שתואמים לחיפוש. אפשר לנקות את הסינון או להוסיף מטופל חדש.
                    </div>
                  ) : null}
                </div>

                {displayMode === "full" ? (
                  <PatientProfileWorkspace
                    patient={selectedPatient}
                    appointments={selectedPatientAppointments}
                    payments={selectedPatientPayments}
                    journalEntries={journalEntries}
                    therapistName={
                      therapistNameById.get(selectedPatient?.therapist_id ?? "") ?? "ללא מטפל"
                    }
                    statusDraft={selectedPatient ? statusDrafts[selectedPatient.id] ?? selectedPatient.status : "חדש"}
                    canManagePatients={patientManagementEnabled}
                    canManageAppointments={appointmentManagementEnabled}
                    canEditClinicalNotes={clinicalNotesEnabled}
                    canManageBilling={billingManagementEnabled}
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
                    onEditPatient={() => {
                      if (!selectedPatient) {
                        return;
                      }
                      handleEditPatient(selectedPatient);
                    }}
                    onAddPayment={({ amount, method, category, note }) => {
                      if (!selectedPatient) {
                        return;
                      }
                      handleAddPayment({
                        patientId: selectedPatient.id,
                        amount,
                        method,
                        category,
                        note,
                      });
                    }}
                    onUpdatePayment={({ paymentId, amount, method, category, note }) => {
                      if (!selectedPatient) {
                        return;
                      }
                      handleUpdatePayment({
                        paymentId,
                        patientId: selectedPatient.id,
                        amount,
                        method,
                        category,
                        note,
                      });
                    }}
                    onDeletePayment={(paymentId) => {
                      if (!selectedPatient) {
                        return;
                      }
                      handleDeletePayment({
                        paymentId,
                        patientId: selectedPatient.id,
                      });
                    }}
                    formatAppointmentDate={formatAppointmentDate}
                    formatAppointmentTime={formatAppointmentTime}
                    formatJournalDate={formatJournalDate}
                  />
                ) : null}
              </>
            )}
            {deleteStatus ? <div className="item-meta">{deleteStatus}</div> : null}
          </section>

          <section className={`panel ${resolvedActiveSection === "appointments" ? "active" : ""}`}>
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

          <section className={`panel ${resolvedActiveSection === "team" ? "active" : ""}`}>
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

          <section className={`panel ${resolvedActiveSection === "reports" ? "active" : ""}`}>
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
        <div className="dialog-backdrop" onClick={closePatientDialog}>
          <div
            className="dialog-card patient-dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="dialog-form" onSubmit={handleAddPatientSubmit}>
              <div className="dialog-head">
                <div>
                  <h3>{editingPatientId ? "עריכת תיק מטופל" : "הוספת מטופל"}</h3>
                  <p className="item-meta">
                    טופס מלא לניהול פרטי מטופל, תיק קליני, תקשורת ונתונים מנהליים.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={closePatientDialog}
                >
                  סגירה
                </button>
              </div>
              <div className="patient-dialog-grid">
                <section className="patient-form-section">
                  <div className="patient-form-section-head">
                    <h4>פרטים בסיסיים</h4>
                    <span>זהות, תחום טיפולי וסטטוס</span>
                  </div>
                  <div className="patient-form-fields">
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
                      תאריך לידה
                      <input
                        type="date"
                        value={addPatientForm.birth_date}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            birth_date: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      מגדר
                      <input
                        value={addPatientForm.gender}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            gender: event.target.value,
                          }))
                        }
                        placeholder="למשל: אישה / גבר / ילד / ילדה"
                      />
                    </label>

                    <label>
                      תואר
                      <input
                        value={addPatientForm.title}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="למשל: סטודנטית / מנהל / תלמיד"
                      />
                    </label>

                    <label>
                      עיסוק
                      <input
                        value={addPatientForm.occupation}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            occupation: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="patient-form-section">
                  <div className="patient-form-section-head">
                    <h4>תקשורת וכתובת</h4>
                    <span>איך יוצרים קשר ואיפה המטופל נמצא</span>
                  </div>
                  <div className="patient-form-fields">
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
                      דוא״ל
                      <input
                        type="email"
                        value={addPatientForm.email}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="name@example.com"
                      />
                    </label>

                    <label>
                      עיר
                      <input
                        value={addPatientForm.city}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            city: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      יישוב
                      <input
                        value={addPatientForm.settlement}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            settlement: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field-span-2">
                      כתובת
                      <input
                        value={addPatientForm.address}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field-span-2">
                      העדפת תקשורת
                      <input
                        value={addPatientForm.communication_preference}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            communication_preference: event.target.value,
                          }))
                        }
                        placeholder="למשל: וואטסאפ / טלפון / מייל"
                      />
                    </label>
                  </div>
                </section>

                <section className="patient-form-section">
                  <div className="patient-form-section-head">
                    <h4>ניהול ותפעול</h4>
                    <span>הפניה, ביטוח ונוכחות</span>
                  </div>
                  <div className="patient-form-fields">
                    <label>
                      מקור הפניה
                      <input
                        value={addPatientForm.referring_source}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            referring_source: event.target.value,
                          }))
                        }
                        placeholder="למשל: רופא, בית ספר, המלצה"
                      />
                    </label>

                    <label>
                      ביטוח
                      <input
                        value={addPatientForm.insurance_provider}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            insurance_provider: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      מסלול / כיסוי
                      <input
                        value={addPatientForm.coverage_track}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            coverage_track: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      סיכון לנשירה
                      <input
                        value={addPatientForm.attendance_risk}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            attendance_risk: event.target.value,
                          }))
                        }
                        placeholder="למשל: נמוך / בינוני / גבוה"
                      />
                    </label>

                    <label className="field-span-2">
                      ימי העדפה / היעדרות
                      <input
                        value={addPatientForm.preferred_days}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            preferred_days: event.target.value,
                          }))
                        }
                        placeholder="למשל: ראשון, שלישי"
                      />
                    </label>
                  </div>
                </section>

                <section className="patient-form-section">
                  <div className="patient-form-section-head">
                    <h4>איש קשר חירום</h4>
                    <span>מישהו זמין במקרה הצורך</span>
                  </div>
                  <div className="patient-form-fields">
                    <label>
                      איש קשר חירום
                      <input
                        value={addPatientForm.emergency_contact_name}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            emergency_contact_name: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      טלפון חירום
                      <input
                        value={addPatientForm.emergency_contact_phone}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            emergency_contact_phone: event.target.value,
                          }))
                        }
                        placeholder="למשל: 0501234567"
                      />
                    </label>
                  </div>
                </section>

                <section className="patient-form-section patient-form-section-wide">
                  <div className="patient-form-section-head">
                    <h4>מידע קליני</h4>
                    <span>אבחנה, רקע רפואי ותמונת תפקוד</span>
                  </div>
                  <div className="patient-form-fields">
                    <label className="field-span-2">
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

                    <label className="field-span-2">
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

                    <label className="field-span-2">
                      תקציר קליטה
                      <textarea
                        rows={3}
                        value={addPatientForm.intake_summary}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            intake_summary: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field-span-2">
                      רקע רפואי
                      <textarea
                        rows={3}
                        value={addPatientForm.medical_background}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            medical_background: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      תרופות
                      <textarea
                        rows={2}
                        value={addPatientForm.medications}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            medications: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      רגישויות / אלרגיות
                      <textarea
                        rows={2}
                        value={addPatientForm.allergies}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            allergies: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field-span-2">
                      מצב תפקודי
                      <textarea
                        rows={2}
                        value={addPatientForm.functional_status}
                        onChange={(event) =>
                          setAddPatientForm((current) => ({
                            ...current,
                            functional_status: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="dialog-actions">
                <button className="primary-btn" type="submit" disabled={isAddingPatient}>
                  {isAddingPatient ? "שומר..." : editingPatientId ? "שמירת שינויים" : "שמירת מטופל"}
                </button>
                <button className="secondary-btn" type="button" onClick={closePatientDialog}>
                  ביטול
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
