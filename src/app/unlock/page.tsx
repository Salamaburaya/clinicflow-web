import { redirect } from "next/navigation";

import { ClinicFlowUnlockForm } from "@/components/clinicflow-unlock-form";
import {
  CLINICFLOW_UNLOCK_PATH,
  isClinicAccessEnabled,
} from "@/lib/clinicflow-access-gate";

type UnlockPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  if (value.startsWith(CLINICFLOW_UNLOCK_PATH)) {
    return "/";
  }

  return value;
}

export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  if (!isClinicAccessEnabled()) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = normalizeNextPath(resolvedSearchParams.next);

  return (
    <main className="clinicflow-unlock-page">
      <section className="clinicflow-unlock-shell">
        <p className="eyebrow">ClinicFlow</p>
        <h1>כניסה למערכת המרפאה</h1>
        <p className="section-summary">
          כדי להמשיך ללוח הבקרה ולתיקי המטופלים, יש להזין את סיסמת הגישה של המרפאה.
        </p>
        <ClinicFlowUnlockForm nextPath={nextPath} />
      </section>
    </main>
  );
}

