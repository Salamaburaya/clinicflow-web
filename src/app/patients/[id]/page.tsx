import { ClinicFlowApp } from "@/components/clinicflow-app";
import { defaultAccessContext } from "@/lib/clinicflow-access";
import { getClinicDashboardData, resolvePatientIdFromKnownData } from "@/lib/clinicflow-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PatientRecordPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PatientRecordPage({ params }: PatientRecordPageProps) {
  const { id } = await params;
  const { therapists, patients, appointments, paymentEntries } =
    await getClinicDashboardData();
  const resolvedFocusedPatientId = resolvePatientIdFromKnownData(id, patients);

  return (
    <ClinicFlowApp
      therapists={therapists}
      initialPatients={patients}
      appointments={appointments}
      initialPaymentEntries={paymentEntries}
      accessContext={defaultAccessContext}
      initialSection="patients"
      displayMode="patient-record"
      focusedPatientId={resolvedFocusedPatientId}
    />
  );
}
