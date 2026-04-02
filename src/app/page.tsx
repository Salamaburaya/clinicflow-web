import { getSupabaseClient } from "@/lib/supabase";

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

function formatAppointmentTime(value: string) {
  return new Date(value).toLocaleString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export default async function Home() {
  const { therapists, patients, appointments, errors } = await getDashboardData();

  const patientCount = patients.length;
  const activeCount = patients.filter((patient) => patient.status === "בטיפול").length;
  const followupCount = patients.filter((patient) => patient.status === "מעקב").length;
  const appointmentCount = appointments.length;

  const therapistNameById = new Map(therapists.map((therapist) => [therapist.id, therapist.full_name]));

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">ClinicFlow</p>
          <h1>מכון פיזיותרפיה וריפוי בעיסוק עם גישה מכל מקום.</h1>
          <p>
            זו כבר אפליקציית Next.js אמיתית שמחוברת ל-Supabase שלך. כרגע היא מציגה את
            הצוות והנתונים מהמסד ותהיה בסיס מצוין להמשך בניית תורים, יומן ומטופלים.
          </p>

          <div className="nav-list">
            <div className="nav-pill">לוח בקרה למנהלת</div>
            <div className="nav-pill">מטופלים</div>
            <div className="nav-pill">תורים</div>
            <div className="nav-pill">צוות מטפל</div>
          </div>
        </div>

        <section className="sidebar-card">
          <span className="eyebrow">הצוות שלך</span>
          <strong>מוחמד חאזקיה וחנין חאזקיה</strong>
          <p>המערכת מוכנה עכשיו להמשך פיתוח ופרסום דרך Vercel.</p>
        </section>
      </aside>

      <section className="content">
        <div className="hero">
          <div>
            <p className="section-tag">סקירה כללית</p>
            <h2>נתוני המכון נטענים ישירות מ-Supabase</h2>
            <p>
              המסך הזה כבר פועל מתוך אפליקציית ווב אמיתית. ברגע שנוסיף מסכי יצירה ועריכה,
              תוכלו לעבוד מול אותו מסד נתונים מכל מחשב או טלפון.
            </p>
          </div>

          <div className="hero-card">
            <strong>התקדמות</strong>
            <p className="muted">Supabase מחובר, Next.js מוכן, ו-Vercel מחכה לפריסה.</p>
            <div className="cta-row">
              <a className="btn primary" href="https://vercel.com/new" target="_blank" rel="noreferrer">
                פתיחת Deploy ב-Vercel
              </a>
            </div>
          </div>
        </div>

        <section className="panel install-panel">
          <div className="panel-head">
            <h3>התקנה לטלפון</h3>
            <span className="muted">PWA מוכן למסך הבית</span>
          </div>
          <div className="install-grid">
            <div className="list-item">
              <strong>אייפון</strong>
              <div>פתח את האתר ב-Safari, לחץ על שיתוף ואז `הוסף למסך הבית`.</div>
            </div>
            <div className="list-item">
              <strong>אנדרואיד</strong>
              <div>פתח את האתר ב-Chrome, לחץ על התפריט ואז `Add to Home screen`.</div>
            </div>
          </div>
        </section>

        {errors.length > 0 ? (
          <section className="panel">
            <div className="panel-head">
              <h3>הערות חיבור</h3>
              <span className="muted">צריך לבדוק לפני פריסה</span>
            </div>
            <div className="stack">
              {errors.map((error) => (
                <div key={error} className="list-item">
                  <strong>בעיה בחיבור לנתונים</strong>
                  <div>{error}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stats-grid">
          <article className="stat-card">
            <span className="muted">מטופלים במערכת</span>
            <strong>{patientCount}</strong>
            <div className="muted">נשלפים מהטבלה `patients`</div>
          </article>
          <article className="stat-card">
            <span className="muted">מטופלים פעילים</span>
            <strong>{activeCount}</strong>
            <div className="muted">סטטוס `בטיפול`</div>
          </article>
          <article className="stat-card">
            <span className="muted">מטופלים במעקב</span>
            <strong>{followupCount}</strong>
            <div className="muted">סטטוס `מעקב`</div>
          </article>
          <article className="stat-card">
            <span className="muted">תורים קרובים</span>
            <strong>{appointmentCount}</strong>
            <div className="muted">שש הרשומות הקרובות ביותר</div>
          </article>
        </section>

        <section className="panels-grid">
          <article className="panel">
            <div className="panel-head">
              <h3>צוות מטפל</h3>
              <span className="muted">{therapists.length} רשומות</span>
            </div>

            {therapists.length === 0 ? (
              <div className="empty">לא נמצאו מטפלים בטבלת `therapists`.</div>
            ) : (
              <div className="team-grid">
                {therapists.map((therapist) => (
                  <article key={therapist.id} className="person-card">
                    <strong>{therapist.full_name}</strong>
                    <div className="muted">{therapist.profession}</div>
                    <div className="chips">
                      <span className="chip">{therapist.specialty ?? "ללא התמחות מוגדרת"}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <h3>תורים קרובים</h3>
              <span className="muted">מתוך `appointments`</span>
            </div>

            {appointments.length === 0 ? (
              <div className="empty">
                עדיין אין תורים במסד הנתונים. זה תקין לשלב הזה. בשלב הבא נוסיף מסך לקביעת
                תור ועריכת יומן טיפול.
              </div>
            ) : (
              <div className="stack">
                {appointments.map((appointment) => (
                  <article key={appointment.id} className="timeline-item">
                    <div className="time-block">{formatAppointmentTime(appointment.appointment_at)}</div>
                    <div>
                      <strong>
                        {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל משויך"}
                      </strong>
                      <div className="muted">{appointment.summary ?? "טרם נכתב סיכום טיפול"}</div>
                      <div className="chips">
                        <span className="chip warm">{appointment.room ?? "חדר לא הוגדר"}</span>
                        <span className="chip">{appointment.status}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="section-tag">מטופלים</p>
              <h3>רשומות מטופלים מתוך מסד הנתונים</h3>
            </div>
            <span className="muted">טבלת `patients`</span>
          </div>

          {patients.length === 0 ? (
            <div className="empty">
              כרגע יש רק את טבלת המטופלים בלי רשומות. זה אומר שהחיבור עובד, ועכשיו נשאר
              להוסיף מסך יצירת מטופל או להזין כמה רשומות התחלתיות.
            </div>
          ) : (
            <div className="patient-grid">
              {patients.map((patient) => (
                <article key={patient.id} className="person-card">
                  <strong>{patient.full_name}</strong>
                  <div className="muted">{patient.diagnosis ?? "אין אבחנה כרגע"}</div>
                  <div className="chips">
                    <span className="chip">{patient.discipline}</span>
                    <span className="chip warm">{patient.status}</span>
                  </div>
                  <p className="muted">{patient.treatment_goal ?? "אין יעד טיפולי שהוזן עדיין"}</p>
                  <div className="muted">
                    מטפל אחראי: {therapistNameById.get(patient.therapist_id ?? "") ?? "טרם שובץ"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
