import { ClinicFlowApp } from "@/components/clinicflow-app";
import { defaultAccessContext } from "@/lib/clinicflow-access";
import { getSupabaseClient } from "@/lib/supabase";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function createSeedAppointment(daysOffset: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function getFallbackClinicData() {
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
      full_name: "מוחמד חאסקיה",
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
      city: "חיפה",
      occupation: "מאמנת כושר",
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
      city: "עכו",
      occupation: "מפתח תוכנה",
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
      city: "שפרעם",
      occupation: "תלמידת כיתה ה'",
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
      city: "נצרת",
      occupation: "גן חובה",
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
      city: "טמרה",
      occupation: "סטודנטית",
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
      city: "סחנין",
      occupation: "מנהל פרויקטים",
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

async function getDashboardData() {
  let supabase: ReturnType<typeof getServerSupabaseClient> | ReturnType<typeof getSupabaseClient>;
  const errors: string[] = [];

  try {
    supabase = getServerSupabaseClient();
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `server-client:${error.message}`
        : "server-client:failed",
    );

    try {
      supabase = getSupabaseClient();
    } catch (clientError) {
      errors.push(
        clientError instanceof Error
          ? `public-client:${clientError.message}`
          : "public-client:failed",
      );

      return {
        ...getFallbackClinicData(),
        errors,
      };
    }
  }

  const [therapistsResult, patientsResult, appointmentsResult, paymentEntriesResult] = await Promise.all([
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

  const result = {
    therapists: (therapistsResult.data ?? []) as Therapist[],
    patients: (patientsResult.data ?? []) as Patient[],
    appointments: (appointmentsResult.data ?? []) as Appointment[],
    paymentEntries: (paymentEntriesResult.data ?? []) as PaymentEntry[],
    errors: [
      ...errors,
      therapistsResult.error?.message,
      patientsResult.error?.message,
      appointmentsResult.error?.message,
      paymentEntriesResult.error?.message,
    ].filter(Boolean) as string[],
  };

  if (
    result.therapists.length === 0
    && result.patients.length === 0
    && result.appointments.length === 0
    && result.paymentEntries.length === 0
  ) {
    return {
      ...getFallbackClinicData(),
      errors: result.errors,
    };
  }

  return result;
}

export default async function Home() {
  const { therapists, patients, appointments, paymentEntries } = await getDashboardData();

  return (
    <ClinicFlowApp
      therapists={therapists}
      initialPatients={patients}
      appointments={appointments}
      initialPaymentEntries={paymentEntries}
      accessContext={defaultAccessContext}
    />
  );
}
