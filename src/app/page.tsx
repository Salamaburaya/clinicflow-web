import { ClinicFlowApp } from "@/components/clinicflow-app";
import { defaultAccessContext } from "@/lib/clinicflow-access";
import { getClinicDashboardData } from "@/lib/clinicflow-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomePageProps = {
  searchParams?: Promise<{
    section?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialSection =
    resolvedSearchParams.section === "patients"
    || resolvedSearchParams.section === "appointments"
    || resolvedSearchParams.section === "team"
    || resolvedSearchParams.section === "reports"
    || resolvedSearchParams.section === "dashboard"
      ? resolvedSearchParams.section
      : undefined;
  const { therapists, patients, appointments, paymentEntries } =
    await getClinicDashboardData();

  return (
    <ClinicFlowApp
      therapists={therapists}
      initialPatients={patients}
      appointments={appointments}
      initialPaymentEntries={paymentEntries}
      accessContext={defaultAccessContext}
      initialSection={initialSection}
    />
  );
}
