import { ClinicFlowApp } from "@/components/clinicflow-app";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Therapist = {
  id: string;
  full_name: string;
  profession: string;
  specialty: string | null;
};

type Patient = {
  id: string;
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string | null;
  treatment_goal: string | null;
  therapist_id: string | null;
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

async function getDashboardData() {
  const supabase = getSupabaseClient();

  const [therapistsResult, patientsResult, appointmentsResult] = await Promise.all([
    supabase.from("therapists").select("*").order("created_at", { ascending: true }),
    supabase.from("patients").select("*").order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*")
      .order("appointment_at", { ascending: true })
      .limit(6),
  ]);

  return {
    therapists: (therapistsResult.data ?? []) as Therapist[],
    patients: (patientsResult.data ?? []) as Patient[],
    appointments: (appointmentsResult.data ?? []) as Appointment[],
    errors: [
      therapistsResult.error?.message,
      patientsResult.error?.message,
      appointmentsResult.error?.message,
    ].filter(Boolean) as string[],
  };
}

export default async function Home() {
  const { therapists, patients, appointments } = await getDashboardData();

  return (
    <ClinicFlowApp
      therapists={therapists}
      initialPatients={patients}
      appointments={appointments}
    />
  );
}
