import { ClinicFlowApp } from "@/components/clinicflow-app";
import { defaultAccessContext } from "@/lib/clinicflow-access";
import { getClinicDashboardData } from "@/lib/clinicflow-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PatientsPage() {
  const { therapists, patients, appointments, paymentEntries } =
    await getClinicDashboardData();

  return (
    <ClinicFlowApp
      therapists={therapists}
      initialPatients={patients}
      appointments={appointments}
      initialPaymentEntries={paymentEntries}
      accessContext={defaultAccessContext}
      initialSection="patients"
      displayMode="patients"
    />
  );
}
