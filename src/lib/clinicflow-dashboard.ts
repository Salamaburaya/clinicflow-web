import { getSupabaseClient } from "@/lib/supabase";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildPatientNotesValue,
  getPatientPaymentEntriesFromNotes,
  hydratePatientRow,
  mergePaymentEntries,
  parsePatientNotes,
  pickPatientProfileMetadata,
  type StoredPaymentEntry,
} from "@/lib/clinicflow-patient-metadata";

type Therapist = {
  id: string;
  full_name: string;
  profession: string;
  specialty: string | null;
  phone: string | null;
};

type Patient = {
  id: string;
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string | null;
  treatment_goal: string | null;
  therapist_id: string | null;
  phone: string | null;
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
  notes?: string | null;
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

export type ClinicDashboardData = {
  therapists: Therapist[];
  patients: Patient[];
  appointments: Appointment[];
  paymentEntries: PaymentEntry[];
  errors: string[];
};

type PublicSupabaseClient = ReturnType<typeof getSupabaseClient>;
type ServerSupabaseClient = ReturnType<typeof getServerSupabaseClient>;
type DashboardSupabaseClient = PublicSupabaseClient | ServerSupabaseClient;

type PatientSeedContext = {
  id: string;
  full_name: string;
  payment_balance?: number | null;
  notes?: unknown;
};

function createSeedAppointment(daysOffset: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function createPatientInsertPayload(
  patient: Patient,
  therapistId: string | null,
  paymentEntries: PaymentEntry[],
) {
  return {
    full_name: patient.full_name,
    discipline: patient.discipline,
    status: patient.status,
    diagnosis: patient.diagnosis,
    treatment_goal: patient.treatment_goal,
    therapist_id: therapistId,
    phone: patient.phone ?? null,
    birth_date: patient.birth_date ?? null,
    notes: buildPatientNotesValue(null, {
      profile: pickPatientProfileMetadata(patient),
      paymentBalance: patient.payment_balance ?? 0,
      paymentEntries: paymentEntries as StoredPaymentEntry[],
    }),
  };
}

export function getFallbackClinicData() {
  const therapists: Therapist[] = [
    {
      id: "seed-therapist-ot",
      full_name: "חנין חאזקיה",
      profession: "ריפוי בעיסוק",
      specialty: "ויסות חושי, תפקוד יומיומי ועבודה עם הורים",
      phone: "0501112233",
    },
    {
      id: "seed-therapist-pt",
      full_name: "מוחמד חאזקיה",
      profession: "פיזיותרפיה",
      specialty: "שיקום אורתופדי, כאב ותפקוד",
      phone: "0502223344",
    },
  ];

  const patients: Patient[] = [
    {
      id: "seed-patient-noa",
      full_name: "נועה אלקיים",
      discipline: "פיזיותרפיה",
      status: "בטיפול",
      diagnosis: "כאבי ברך לאחר עומס מתמשך",
      treatment_goal: "חזרה לפעילות מלאה והפחתת כאב במדרגות",
      therapist_id: "seed-therapist-pt",
      phone: "0504445566",
      email: "noa.elk@example.com",
      city: "חיפה",
      settlement: "חיפה",
      address: "רחוב הגפן 18",
      birth_date: "1996-07-14",
      gender: "אישה",
      title: "מטופלת",
      occupation: "מאמנת כושר",
      referring_source: "הפניה מאורתופד ספורט",
      intake_summary:
        "הגיעה בעקבות כאב בברך ימין שמתגבר באימוני כוח, עלייה במדרגות וריצה קצרה.",
      medical_background:
        "היסטוריה של עומס חוזר סביב הפיקה בתקופות אימון אינטנסיביות.",
      medications: "משכך כאב לפי צורך בלבד",
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
    },
    {
      id: "seed-patient-yosef",
      full_name: "יוסף סבג",
      discipline: "פיזיותרפיה",
      status: "מעקב",
      diagnosis: "כאבי גב תחתון לאחר ישיבה ממושכת",
      treatment_goal: "הפחתת כאב ושיפור סבולת לישיבה ולעבודה",
      therapist_id: "seed-therapist-pt",
      phone: "0506667788",
      email: "yosef.sabag@example.com",
      city: "עכו",
      settlement: "עכו",
      address: "רחוב הכלנית 3",
      birth_date: "1988-02-27",
      gender: "גבר",
      title: "מטופל",
      occupation: "מפתח תוכנה",
      referring_source: "הגעה עצמאית דרך אתר הקליניקה",
      intake_summary:
        "מדווח על כאב גב תחתון שמתגבר לאחר ישיבה ממושכת ועבודה מול מחשב.",
      medical_background: "פריצת דיסק ישנה ללא ניתוח.",
      medications: "אטופן לפי צורך",
      allergies: "ללא רגישויות ידועות",
      emergency_contact_name: "יעל סבג",
      emergency_contact_phone: "0549003300",
      insurance_provider: "כלל בריאות",
      coverage_track: "פרטי",
      communication_preference: "מייל + וואטסאפ",
      preferred_days: "שלישי, שישי",
      attendance_risk: "נמוך",
      functional_status: "עובד במשרה מלאה אך מגביל נהיגה ארוכה.",
      payment_balance: 320,
    },
    {
      id: "seed-patient-lina",
      full_name: "לינא מרעי",
      discipline: "ריפוי בעיסוק",
      status: "בטיפול",
      diagnosis: "קושי בכתיבה ובהתארגנות בכיתה",
      treatment_goal: "שיפור עצמאות בכיתה, אחיזת עיפרון וסבולת למשימות שולחן",
      therapist_id: "seed-therapist-ot",
      phone: "0507132244",
      email: "lina.marai@example.com",
      city: "שפרעם",
      settlement: "שפרעם",
      address: "רחוב המעיין 9",
      birth_date: "2015-04-19",
      gender: "בת",
      title: "תלמידה",
      occupation: "תלמידת כיתה ה'",
      referring_source: "הפניה מיועצת בית הספר",
      intake_summary:
        "הגיעה בעקבות קושי בכתיבה ממושכת, הימנעות ממשימות שולחן ועייפות מהירה בשיעורים.",
      medical_background:
        "הערכה קודמת העלתה קושי קל במוטוריקה עדינה ובוויסות ישיבה.",
      medications: "ללא טיפול תרופתי קבוע",
      allergies: "רגישות קלה לפניצילין",
      emergency_contact_name: "רנא מרעי",
      emergency_contact_phone: "0528331144",
      insurance_provider: "מאוחדת שיא",
      coverage_track: "התחייבות קופה",
      communication_preference: "טלפון לאם",
      preferred_days: "ראשון, שלישי",
      attendance_risk: "נמוך",
      functional_status: "עצמאית בפעולות יום יום, אך נזקקת לתיווך בתחילת משימות לימודיות.",
      payment_balance: 0,
    },
    {
      id: "seed-patient-adam",
      full_name: "אדם חורי",
      discipline: "ריפוי בעיסוק",
      status: "חדש",
      diagnosis: "קושי במעברים, ויסות ותפקוד בוקר",
      treatment_goal: "שיפור עצמאות בבוקר והפחתת עומס סביב יציאה למסגרת",
      therapist_id: "seed-therapist-ot",
      phone: "0509921148",
      email: "adam.khouri@example.com",
      city: "נצרת",
      settlement: "נצרת",
      address: "רחוב אלון 24",
      birth_date: "2017-09-02",
      gender: "בן",
      title: "ילד",
      occupation: "גן חובה",
      referring_source: "הפניה מרופאת התפתחות הילד",
      intake_summary: "ההורים מתארים קושי במעברים, התנגדות להתלבשות ועומס חושי.",
      medical_background: "מעקב התפתחותי קיים עם קושי בוויסות חושי ואכילה בררנית.",
      medications: "ללא תרופות קבועות",
      allergies: "רגישות לחלב",
      emergency_contact_name: "סמאח חורי",
      emergency_contact_phone: "0542211188",
      insurance_provider: "מכבי שלי",
      coverage_track: "אישור פתיחת סדרה",
      communication_preference: "וואטסאפ להורה",
      preferred_days: "שני, חמישי",
      attendance_risk: "בינוני",
      functional_status: "נדרש תיווך גבוה במעברים ובשגרות בוקר.",
      payment_balance: 240,
    },
    {
      id: "seed-patient-mira",
      full_name: "מירה אבו ריא",
      discipline: "פיזיותרפיה",
      status: "בטיפול",
      diagnosis: "שיקום אחרי נקע קרסול חוזר",
      treatment_goal: "חזרה להליכה יציבה ולריצה קלה ללא כאב",
      therapist_id: "seed-therapist-pt",
      phone: "0525511147",
      email: "mira.aburia@example.com",
      city: "טמרה",
      settlement: "טמרה",
      address: "רחוב הזית 11",
      birth_date: "2001-12-08",
      gender: "אישה",
      title: "מטופלת",
      occupation: "סטודנטית",
      referring_source: "הפניה מאורתופד קהילה",
      intake_summary: "לאחר שני נקעים חוזרים מדווחת על חוסר יציבות ופחד מעומס על הקרסול.",
      medical_background: "היסטוריה של גמישות יתר קלה וירידה בביטחון בתנועה מהירה.",
      medications: "ללא תרופות קבועות",
      allergies: "ללא רגישויות ידועות",
      emergency_contact_name: "ראמי אבו ריא",
      emergency_contact_phone: "0528800011",
      insurance_provider: "מנורה",
      coverage_track: "פרטי",
      communication_preference: "וואטסאפ",
      preferred_days: "שני, רביעי",
      attendance_risk: "נמוך",
      functional_status: "הולכת עצמאית אך נמנעת מהליכה מהירה ומריצה.",
      payment_balance: 180,
    },
    {
      id: "seed-patient-razi",
      full_name: "ראזי נסאר",
      discipline: "פיזיותרפיה",
      status: "מעקב",
      diagnosis: "כאבי צוואר וכתף עקב עבודה מול מחשב",
      treatment_goal: "שיפור טווחים, הפחתת כאב ועבודה רציפה ללא החמרה",
      therapist_id: "seed-therapist-pt",
      phone: "0543311458",
      email: "razi.nassar@example.com",
      city: "סחנין",
      settlement: "סחנין",
      address: "רחוב ההר 5",
      birth_date: "1991-05-21",
      gender: "גבר",
      title: "מטופל",
      occupation: "מנהל פרויקטים",
      referring_source: "המלצה ממטופל קיים",
      intake_summary: "כאב בצוואר ובכתף ימין בסוף יום עבודה עם הקרנה קלה.",
      medical_background: "תקופות קודמות של כאב צווארי סביב עומס תעסוקתי.",
      medications: "אתופן לפי צורך",
      allergies: "ללא רגישויות ידועות",
      emergency_contact_name: "דימא נסאר",
      emergency_contact_phone: "0500007788",
      insurance_provider: "הראל",
      coverage_track: "פרטי",
      communication_preference: "מייל",
      preferred_days: "ראשון, חמישי",
      attendance_risk: "נמוך",
      functional_status: "עובד מלא אך עם ירידה בריכוז וכאב בסוף יום.",
      payment_balance: -120,
    },
  ];

  const appointments: Appointment[] = [
    {
      id: "seed-appointment-1",
      room: "חדר 2",
      status: "scheduled",
      summary: "מעקב תפקודי והתקדמות לעומסים",
      appointment_at: createSeedAppointment(3, 9, 0),
      patient_id: "seed-patient-noa",
      therapist_id: "seed-therapist-pt",
    },
    {
      id: "seed-appointment-2",
      room: "חדר 1",
      status: "scheduled",
      summary: "בדיקת עומסים והמשך תרגול",
      appointment_at: createSeedAppointment(4, 17, 0),
      patient_id: "seed-patient-yosef",
      therapist_id: "seed-therapist-pt",
    },
    {
      id: "seed-appointment-3",
      room: "חדר 4",
      status: "scheduled",
      summary: "המשך עבודה על כתיבה ועמדת ישיבה",
      appointment_at: createSeedAppointment(2, 16, 0),
      patient_id: "seed-patient-lina",
      therapist_id: "seed-therapist-ot",
    },
    {
      id: "seed-appointment-4",
      room: "חדר 4",
      status: "scheduled",
      summary: "התחלת תהליך ויסות ושגרת בוקר",
      appointment_at: createSeedAppointment(5, 13, 30),
      patient_id: "seed-patient-adam",
      therapist_id: "seed-therapist-ot",
    },
    {
      id: "seed-appointment-5",
      room: "חדר 2",
      status: "scheduled",
      summary: "המשך הדרגת עומס ונחיתות",
      appointment_at: createSeedAppointment(1, 10, 0),
      patient_id: "seed-patient-mira",
      therapist_id: "seed-therapist-pt",
    },
    {
      id: "seed-appointment-6",
      room: "חדר 2",
      status: "scheduled",
      summary: "מעקב סביב עומס עבודה והמשך תרגול",
      appointment_at: createSeedAppointment(7, 17, 30),
      patient_id: "seed-patient-razi",
      therapist_id: "seed-therapist-pt",
    },
  ];

  const paymentEntries: PaymentEntry[] = [
    {
      id: "seed-payment-1",
      patient_id: "seed-patient-noa",
      created_at: createSeedAppointment(-10, 12, 0),
      payment_date: createSeedAppointment(-10, 12, 0),
      amount: 180,
      method: "אשראי",
      status: "completed",
      category: "מפגש טיפול",
      note: "תשלום על מפגש המשך",
    },
    {
      id: "seed-payment-2",
      patient_id: "seed-patient-razi",
      created_at: createSeedAppointment(-7, 12, 0),
      payment_date: createSeedAppointment(-7, 12, 0),
      amount: 120,
      method: "ביט",
      status: "completed",
      category: "מפגש טיפול",
      note: "שולם במקום",
    },
    {
      id: "seed-payment-3",
      patient_id: "seed-patient-mira",
      created_at: createSeedAppointment(-4, 12, 0),
      payment_date: createSeedAppointment(-4, 12, 0),
      amount: 180,
      method: "העברה",
      status: "completed",
      category: "חבילת טיפולים",
      note: "תשלום עבור חבילת מפגשים",
    },
  ];

  return { therapists, patients, appointments, paymentEntries };
}

export function getSeedPatientFullNameById(patientId: string) {
  return (
    getFallbackClinicData().patients.find((patient) => patient.id === patientId)?.full_name ?? null
  );
}

export function getSeedTherapistFullNameById(therapistId: string) {
  return (
    getFallbackClinicData().therapists.find((therapist) => therapist.id === therapistId)?.full_name
    ?? null
  );
}

export function resolvePatientIdFromKnownData<
  TPatient extends {
    id: string;
    full_name: string;
  },
>(patientId: string, patients: TPatient[]) {
  if (!patientId) {
    return patientId;
  }

  const directMatch = patients.find((patient) => patient.id === patientId);
  if (directMatch) {
    return directMatch.id;
  }

  const seedFullName = getSeedPatientFullNameById(patientId);
  if (!seedFullName) {
    return patientId;
  }

  return patients.find((patient) => patient.full_name === seedFullName)?.id ?? patientId;
}

export function getSeedPaymentEntriesForPatients(
  patients: PatientSeedContext[],
  existingEntries: StoredPaymentEntry[],
) {
  const fallback = getFallbackClinicData();
  const storedPatientsByName = new Map(
    patients.map((patient) => [patient.full_name, patient]),
  );

  return fallback.paymentEntries.flatMap((entry) => {
    const seedPatient = fallback.patients.find(
      (patient) => patient.id === entry.patient_id,
    );

    if (!seedPatient) {
      return [];
    }

    const storedPatient = storedPatientsByName.get(seedPatient.full_name);

    if (!storedPatient) {
      return [];
    }

    const existingNoteEntries = getPatientPaymentEntriesFromNotes(
      storedPatient.id,
      storedPatient.notes,
    ) as StoredPaymentEntry[];
    const currentBalance = parsePatientNotes(storedPatient.notes).paymentBalance ?? 0;
    const existingEntryExists = existingEntries.some(
      (existingEntry) =>
        existingEntry.patient_id === storedPatient.id &&
        (existingEntry.id === entry.id ||
          (existingEntry.payment_date === entry.payment_date &&
            Number(existingEntry.amount) === Number(entry.amount) &&
            existingEntry.category === entry.category)),
    );

    if (
      existingEntryExists ||
      existingNoteEntries.length > 0 ||
      currentBalance !== (seedPatient.payment_balance ?? 0)
    ) {
      return [];
    }

    return [
      {
        ...entry,
        patient_id: storedPatient.id,
      } satisfies StoredPaymentEntry,
    ];
  });
}

async function loadClinicRows(supabase: DashboardSupabaseClient): Promise<ClinicDashboardData> {
  const [therapistsResult, patientsResult, appointmentsResult, paymentEntriesResult] =
    await Promise.all([
      supabase.from("therapists").select("*").order("created_at", { ascending: true }),
      supabase.from("patients").select("*").order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .order("appointment_at", { ascending: true }),
      supabase
        .from("payment_entries")
        .select("*")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  const patientRows = ((patientsResult.data ?? []) as Patient[]).map((row) =>
    hydratePatientRow(row),
  ) as Patient[];
  const notePaymentEntries = ((patientsResult.data ?? []) as Patient[]).flatMap((row) =>
    getPatientPaymentEntriesFromNotes(row.id, row.notes),
  ) as PaymentEntry[];
  const tablePaymentEntries = (paymentEntriesResult.data ?? []) as PaymentEntry[];
  const mergedPaymentEntries = mergePaymentEntries(
    tablePaymentEntries as StoredPaymentEntry[],
    notePaymentEntries as StoredPaymentEntry[],
  ) as PaymentEntry[];
  const seedPaymentEntries = getSeedPaymentEntriesForPatients(
    patientRows,
    mergedPaymentEntries as StoredPaymentEntry[],
  ) as PaymentEntry[];
  const resolvedPaymentEntries = mergePaymentEntries(
    mergedPaymentEntries as StoredPaymentEntry[],
    seedPaymentEntries as StoredPaymentEntry[],
  ) as PaymentEntry[];
  const paymentEntriesErrorMessage = paymentEntriesResult.error?.message ?? null;
  const paymentEntriesMissingTable =
    paymentEntriesErrorMessage?.includes("Could not find the table 'public.payment_entries'")
    ?? false;

  return {
    therapists: (therapistsResult.data ?? []) as Therapist[],
    patients: patientRows,
    appointments: (appointmentsResult.data ?? []) as Appointment[],
    paymentEntries: resolvedPaymentEntries,
    errors: [
      therapistsResult.error?.message,
      patientsResult.error?.message,
      appointmentsResult.error?.message,
      paymentEntriesMissingTable ? null : paymentEntriesErrorMessage,
    ].filter(Boolean) as string[],
  };
}

function hasClinicData(result: ClinicDashboardData) {
  return result.patients.length > 0;
}

function shouldEnsureServerSeed(result: ClinicDashboardData) {
  if (result.patients.length === 0) {
    return true;
  }

  const fallback = getFallbackClinicData();
  const therapistNames = new Set(
    result.therapists.map((therapist) => therapist.full_name),
  );
  const patientByName = new Map(
    result.patients.map((patient) => [patient.full_name, patient]),
  );

  if (
    fallback.therapists.some(
      (therapist) => !therapistNames.has(therapist.full_name),
    )
  ) {
    return true;
  }

  if (
    fallback.patients.some((patient) => !patientByName.has(patient.full_name))
  ) {
    return true;
  }

  return fallback.patients.some((fallbackPatient) => {
    const fallbackEntries = fallback.paymentEntries.filter(
      (entry) => entry.patient_id === fallbackPatient.id,
    );

    if (fallbackEntries.length === 0) {
      return false;
    }

    const storedPatient = patientByName.get(fallbackPatient.full_name);

    if (!storedPatient) {
      return false;
    }

    const existingNoteEntries = getPatientPaymentEntriesFromNotes(
      storedPatient.id,
      storedPatient.notes,
    );
    const currentBalance = parsePatientNotes(storedPatient.notes).paymentBalance ?? 0;

    return (
      existingNoteEntries.length === 0
      && currentBalance === (fallbackPatient.payment_balance ?? 0)
    );
  });
}

async function ensureSeedClinicDataOnServer(
  supabase: ServerSupabaseClient,
): Promise<ClinicDashboardData> {
  const fallback = getFallbackClinicData();
  const seedErrors: string[] = [];

  const therapistNames = fallback.therapists.map((therapist) => therapist.full_name);
  const therapistLookupResult = await supabase
    .from("therapists")
    .select("*")
    .in("full_name", therapistNames);

  const initialTherapistRows = (therapistLookupResult.data ?? []) as Therapist[];
  if (therapistLookupResult.error) {
    seedErrors.push(`lookup-therapists:${therapistLookupResult.error.message}`);
  }

  const existingTherapistNames = new Set(
    initialTherapistRows.map((therapist) => therapist.full_name),
  );
  const missingTherapists = fallback.therapists.filter(
    (therapist) => !existingTherapistNames.has(therapist.full_name),
  );

  if (missingTherapists.length > 0) {
    const therapistInsertResult = await supabase
      .from("therapists")
      .insert(
        missingTherapists.map((therapist) => ({
          full_name: therapist.full_name,
          profession: therapist.profession,
          specialty: therapist.specialty,
          phone: therapist.phone,
        })),
      )
      .select("*");

    if (therapistInsertResult.error) {
      seedErrors.push(`seed-therapists:${therapistInsertResult.error.message}`);
    }
  }

  const refreshedTherapistLookupResult = await supabase
    .from("therapists")
    .select("*")
    .in("full_name", therapistNames);

  const therapistRows = (refreshedTherapistLookupResult.data ?? []) as Therapist[];
  if (refreshedTherapistLookupResult.error) {
    seedErrors.push(`refresh-therapists:${refreshedTherapistLookupResult.error.message}`);
  }

  const therapistIdMap = new Map<string, string>();
  fallback.therapists.forEach((seedTherapist) => {
    const storedTherapist = therapistRows.find(
      (therapist) => therapist.full_name === seedTherapist.full_name,
    );
    if (storedTherapist) {
      therapistIdMap.set(seedTherapist.id, storedTherapist.id);
    }
  });

  const patientNames = fallback.patients.map((patient) => patient.full_name);
  const patientLookupResult = await supabase
    .from("patients")
    .select("*")
    .in("full_name", patientNames);

  const initialPatientRows = (patientLookupResult.data ?? []) as Patient[];
  if (patientLookupResult.error) {
    seedErrors.push(`lookup-patients:${patientLookupResult.error.message}`);
  }

  const existingPatientNames = new Set(initialPatientRows.map((patient) => patient.full_name));
  const missingPatients = fallback.patients.filter(
    (patient) => !existingPatientNames.has(patient.full_name),
  );

  if (missingPatients.length > 0) {
    const patientInsertResult = await supabase
      .from("patients")
      .insert(
        missingPatients.map((patient) =>
          createPatientInsertPayload(
            patient,
            patient.therapist_id
              ? therapistIdMap.get(patient.therapist_id) ?? null
              : null,
            [],
          )),
      )
      .select("*");

    if (patientInsertResult.error) {
      seedErrors.push(`seed-patients:${patientInsertResult.error.message}`);
    }
  }

  const refreshedPatientLookupResult = await supabase
    .from("patients")
    .select("*")
    .in("full_name", patientNames);

  const patientRows = ((refreshedPatientLookupResult.data ?? []) as Patient[]).map((row) =>
    hydratePatientRow(row),
  ) as Patient[];
  if (refreshedPatientLookupResult.error) {
    seedErrors.push(`refresh-patients:${refreshedPatientLookupResult.error.message}`);
  }

  const patientIdMap = new Map<string, string>();
  fallback.patients.forEach((seedPatient) => {
    const storedPatient = patientRows.find(
      (patient) => patient.full_name === seedPatient.full_name,
    );
    if (storedPatient) {
      patientIdMap.set(seedPatient.id, storedPatient.id);
    }
  });

  for (const fallbackPatient of fallback.patients) {
    const storedPatient = patientRows.find(
      (patient) => patient.full_name === fallbackPatient.full_name,
    );

    if (!storedPatient) {
      continue;
    }

    const fallbackEntriesForPatient = fallback.paymentEntries
      .filter((entry) => entry.patient_id === fallbackPatient.id)
      .map((entry) => ({
        ...entry,
        patient_id: storedPatient.id,
      })) as StoredPaymentEntry[];
    const existingNoteEntries = getPatientPaymentEntriesFromNotes(
      storedPatient.id,
      storedPatient.notes,
    ) as StoredPaymentEntry[];
    const shouldBackfillSeedEntries =
      existingNoteEntries.length === 0
      && fallbackEntriesForPatient.length > 0
      && Number(parsePatientNotes(storedPatient.notes).paymentBalance ?? 0)
        === Number(fallbackPatient.payment_balance ?? 0);

    const nextNotes = buildPatientNotesValue(storedPatient.notes, {
      profile: {
        ...pickPatientProfileMetadata(fallbackPatient),
        ...pickPatientProfileMetadata(storedPatient),
      },
      paymentBalance:
        parsePatientNotes(storedPatient.notes).paymentBalance ?? (fallbackPatient.payment_balance ?? 0),
      paymentEntries: shouldBackfillSeedEntries
        ? fallbackEntriesForPatient
        : existingNoteEntries,
    });

    if (nextNotes === (storedPatient.notes ?? null)) {
      continue;
    }

    const notesUpdateResult = await supabase
      .from("patients")
      .update({ notes: nextNotes })
      .eq("id", storedPatient.id);

    if (notesUpdateResult.error) {
      seedErrors.push(`seed-patient-notes:${notesUpdateResult.error.message}`);
    }
  }

  const seededPatientIds = Array.from(patientIdMap.values());
  if (seededPatientIds.length > 0) {
    const appointmentsLookupResult = await supabase
      .from("appointments")
      .select("patient_id, appointment_at")
      .in("patient_id", seededPatientIds);

    const existingAppointmentKeys = new Set(
      (appointmentsLookupResult.data ?? []).map(
        (appointment) => `${appointment.patient_id}:${appointment.appointment_at}`,
      ),
    );

    if (appointmentsLookupResult.error) {
      seedErrors.push(`lookup-appointments:${appointmentsLookupResult.error.message}`);
    } else {
      const missingAppointments = fallback.appointments
        .map((appointment) => ({
          patient_id: patientIdMap.get(appointment.patient_id) ?? null,
          therapist_id: appointment.therapist_id
            ? therapistIdMap.get(appointment.therapist_id) ?? null
            : null,
          appointment_at: appointment.appointment_at,
          room: appointment.room,
          status: appointment.status,
          summary: appointment.summary,
        }))
        .filter(
          (appointment): appointment is {
            patient_id: string;
            therapist_id: string | null;
            appointment_at: string;
            room: string | null;
            status: string;
            summary: string | null;
          } =>
            Boolean(appointment.patient_id)
            && !existingAppointmentKeys.has(
              `${appointment.patient_id}:${appointment.appointment_at}`,
            ),
        );

      if (missingAppointments.length > 0) {
        const appointmentInsertResult = await supabase
          .from("appointments")
          .insert(missingAppointments);

        if (appointmentInsertResult.error) {
          seedErrors.push(`seed-appointments:${appointmentInsertResult.error.message}`);
        }
      }
    }

    const paymentsLookupResult = await supabase
      .from("payment_entries")
      .select("patient_id, payment_date, amount, category")
      .in("patient_id", seededPatientIds);

    const existingPaymentKeys = new Set(
      (paymentsLookupResult.data ?? []).map(
        (entry) => `${entry.patient_id}:${entry.payment_date}:${entry.amount}:${entry.category}`,
      ),
    );

    const paymentTableMissing =
      paymentsLookupResult.error?.message?.includes(
        "Could not find the table 'public.payment_entries'",
      ) ?? false;

    if (paymentsLookupResult.error && !paymentTableMissing) {
      seedErrors.push(`lookup-payments:${paymentsLookupResult.error.message}`);
    } else if (!paymentTableMissing) {
      const missingPayments = fallback.paymentEntries
        .map((entry) => ({
          patient_id: patientIdMap.get(entry.patient_id) ?? null,
          created_at: entry.created_at,
          payment_date: entry.payment_date,
          amount: entry.amount,
          method: entry.method,
          status: entry.status,
          category: entry.category,
          note: entry.note,
        }))
        .filter(
          (entry): entry is {
            patient_id: string;
            created_at: string;
            payment_date: string;
            amount: number;
            method: string;
            status: "completed" | "pending" | "refunded";
            category: string;
            note: string | null;
          } =>
            Boolean(entry.patient_id)
            && !existingPaymentKeys.has(
              `${entry.patient_id}:${entry.payment_date}:${entry.amount}:${entry.category}`,
            ),
        );

      if (missingPayments.length > 0) {
        const paymentInsertResult = await supabase
          .from("payment_entries")
          .insert(missingPayments);

        if (paymentInsertResult.error) {
          seedErrors.push(`seed-payments:${paymentInsertResult.error.message}`);
        }
      }
    }
  }

  const loaded = await loadClinicRows(supabase);
  return {
    ...loaded,
    errors: [...seedErrors, ...loaded.errors],
  };
}

export async function getClinicDashboardData(): Promise<ClinicDashboardData> {
  const errors: string[] = [];

  try {
    const serverSupabase = getServerSupabaseClient();
    const serverData = await loadClinicRows(serverSupabase);

    if (shouldEnsureServerSeed(serverData)) {
      const seededServerData = await ensureSeedClinicDataOnServer(serverSupabase);
      if (hasClinicData(seededServerData)) {
        return seededServerData;
      }

      return {
        ...getFallbackClinicData(),
        errors: [...errors, ...seededServerData.errors],
      };
    }

    if (hasClinicData(serverData)) {
      return serverData;
    }
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `server-client:${error.message}`
        : "server-client:failed",
    );
  }

  try {
    const publicSupabase = getSupabaseClient();
    const publicData = await loadClinicRows(publicSupabase);
    if (hasClinicData(publicData)) {
      return {
        ...publicData,
        errors: [...errors, ...publicData.errors],
      };
    }

    return {
      ...getFallbackClinicData(),
      errors: [...errors, ...publicData.errors],
    };
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `public-client:${error.message}`
        : "public-client:failed",
    );
  }

  return {
    ...getFallbackClinicData(),
    errors,
  };
}
