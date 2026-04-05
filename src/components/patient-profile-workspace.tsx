"use client";

import { useState } from "react";

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

type PatientProfileWorkspaceProps = {
  patient?: Patient;
  appointments: Appointment[];
  journalEntries: JournalEntry[];
  therapistName: string;
  statusDraft: string;
  canManagePatients: boolean;
  canManageAppointments: boolean;
  canEditClinicalNotes: boolean;
  onStatusDraftChange: (value: string) => void;
  onStatusSave: () => void;
  onOpenJournal: () => void;
  onCreateAppointment: () => void;
  formatAppointmentDate: (value: string) => string;
  formatAppointmentTime: (value: string) => string;
  formatJournalDate: (value: string) => string;
};

type WorkspaceTab = "overview" | "sessions" | "notes" | "billing";

const workspaceTabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: "overview", label: "סקירה" },
  { key: "sessions", label: "מפגשים" },
  { key: "notes", label: "תיעוד" },
  { key: "billing", label: "תשלומים" },
];

function getPatientAge(value?: string | null) {
  if (!value) {
    return null;
  }

  const birthDate = new Date(value);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function formatCurrency(value?: number | null) {
  if (!value) {
    return "0 ש״ח";
  }

  return `${value > 0 ? "+" : ""}${value} ש״ח`;
}

export function PatientProfileWorkspace({
  patient,
  appointments,
  journalEntries,
  therapistName,
  statusDraft,
  canManagePatients,
  canManageAppointments,
  canEditClinicalNotes,
  onStatusDraftChange,
  onStatusSave,
  onOpenJournal,
  onCreateAppointment,
  formatAppointmentDate,
  formatAppointmentTime,
  formatJournalDate,
}: PatientProfileWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  if (!patient) {
    return (
      <article className="card patient-workspace-card">
        <div className="empty-card">
          בחר מטופל מהרשימה כדי לפתוח כרטיס מטופל מקצועי עם מפגשים, תיעוד וסקירה.
        </div>
      </article>
    );
  }

  const nextAppointment = appointments[0];
  const latestEntry = journalEntries[0];
  const completedAppointments = appointments.length;
  const patientAge = getPatientAge(patient.birth_date);
  const paymentBalance = patient.payment_balance ?? 0;

  const overviewItems = [
    {
      label: "מטפל אחראי",
      value: therapistName,
      tone: "neutral",
    },
    {
      label: "תור הבא",
      value: nextAppointment
        ? `${formatAppointmentDate(nextAppointment.appointment_at)} | ${formatAppointmentTime(nextAppointment.appointment_at)}`
        : "טרם נקבע",
      tone: nextAppointment ? "good" : "warn",
    },
    {
      label: "אבחנה",
      value: patient.diagnosis ?? "חסרה אבחנה מסודרת",
      tone: patient.diagnosis ? "neutral" : "warn",
    },
    {
      label: "יעד טיפולי",
      value: patient.treatment_goal ?? "חסר יעד טיפולי",
      tone: patient.treatment_goal ? "neutral" : "warn",
    },
  ];

  const profileFacts = [
    { label: "גיל", value: patientAge ? `${patientAge}` : "לא הוזן" },
    { label: "מגדר", value: patient.gender ?? "לא הוזן" },
    { label: "עיר", value: patient.city ?? "לא הוזנה" },
    { label: "עיסוק", value: patient.occupation ?? "לא הוזן" },
    { label: "מקור הפניה", value: patient.referring_source ?? "לא הוזן" },
    { label: "העדפת תקשורת", value: patient.communication_preference ?? "לא הוזנה" },
  ];

  const adminItems = [
    {
      label: "איש קשר חירום",
      value:
        patient.emergency_contact_name && patient.emergency_contact_phone
          ? `${patient.emergency_contact_name} | ${patient.emergency_contact_phone}`
          : "לא הוגדר",
    },
    {
      label: "ביטוח / מסלול",
      value:
        patient.insurance_provider || patient.coverage_track
          ? `${patient.insurance_provider ?? "ללא ביטוח"} | ${patient.coverage_track ?? "ללא מסלול"}`
          : "לא הוגדר",
    },
    {
      label: "ימי העדפה",
      value: patient.preferred_days ?? "לא הוגדרו",
    },
    {
      label: "סיכון לנשירה",
      value: patient.attendance_risk ?? "לא הוערך",
    },
  ];

  return (
    <article className="card patient-workspace-card">
      <div className="patient-workspace-hero">
        <div className="patient-workspace-header">
          <div className="patient-avatar" aria-hidden="true">
            {patient.full_name.slice(0, 1)}
          </div>
          <div className="patient-title-block">
            <p className="section-tag">כרטיס מטופל</p>
            <h3>{patient.full_name}</h3>
            <div className="chips">
              <span className="chip">{patient.discipline}</span>
              <span className="chip warm">{patient.status}</span>
              <span className="chip chip-muted">{therapistName}</span>
            </div>
          </div>
        </div>

        <div className="patient-workspace-actions">
          {canEditClinicalNotes ? (
            <button className="primary-btn" type="button" onClick={onOpenJournal}>
              תיעוד מפגש
            </button>
          ) : null}
          {canManageAppointments ? (
            <button className="secondary-btn" type="button" onClick={onCreateAppointment}>
              הוספת מפגש
            </button>
          ) : null}
        </div>
      </div>

      <div className="patient-kpi-grid">
        <div className="patient-kpi-card">
          <span>מפגשים קודמים</span>
          <strong>{completedAppointments}</strong>
        </div>
        <div className="patient-kpi-card">
          <span>רשומות תיעוד</span>
          <strong>{journalEntries.length}</strong>
        </div>
        <div className="patient-kpi-card">
          <span>קשר ראשי</span>
          <strong>{patient.phone ?? patient.email ?? "לא הוזן"}</strong>
        </div>
        <div className="patient-kpi-card">
          <span>יתרה</span>
          <strong>{formatCurrency(paymentBalance)}</strong>
        </div>
      </div>

      <div className="patient-tabs">
        {workspaceTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`patient-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="patient-workspace-grid patient-workspace-grid-rich">
          <section className="workspace-panel-card">
            <div className="card-head">
              <h4>תמונת מצב</h4>
              <span>סקירה מיידית</span>
            </div>
            <div className="workspace-overview-grid">
              {overviewItems.map((item) => (
                <article
                  key={item.label}
                  className={`workspace-overview-item tone-${item.tone}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="workspace-panel-card">
            <div className="card-head">
              <h4>פעולות מהירות</h4>
              <span>עבודה שוטפת</span>
            </div>
            <div className="workspace-actions-column">
              <label className="inline-field">
                <span>סטטוס מטופל</span>
                <select
                  value={statusDraft}
                  onChange={(event) => onStatusDraftChange(event.target.value)}
                  disabled={!canManagePatients}
                >
                  <option value="חדש">חדש</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="מעקב">מעקב</option>
                </select>
              </label>
              {canManagePatients ? (
                <button className="secondary-btn" type="button" onClick={onStatusSave}>
                  שמירת סטטוס
                </button>
              ) : (
                <div className="item-meta">לתפקיד הנוכחי אין הרשאת עריכת סטטוס</div>
              )}
              <div className="workspace-note-callout">
                <strong>רשומה אחרונה</strong>
                <span>
                  {latestEntry
                    ? `${formatJournalDate(latestEntry.entry_date)} | עודכן תיעוד אחרון`
                    : "עדיין אין רשומת תיעוד"}
                </span>
              </div>
            </div>
          </section>

          <section className="workspace-panel-card">
            <div className="card-head">
              <h4>פרטי תיק</h4>
              <span>דמוגרפיה ותקשורת</span>
            </div>
            <div className="workspace-overview-grid workspace-overview-grid-compact">
              {profileFacts.map((item) => (
                <article key={item.label} className="workspace-overview-item tone-neutral">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
            <div className="workspace-rich-text-grid">
              <article className="workspace-rich-card">
                <span>כתובת</span>
                <strong>{patient.address ?? "לא הוזנה כתובת"}</strong>
              </article>
              <article className="workspace-rich-card">
                <span>דוא״ל</span>
                <strong>{patient.email ?? "לא הוזן דוא״ל"}</strong>
              </article>
            </div>
          </section>

          <section className="workspace-panel-card">
            <div className="card-head">
              <h4>רקע קליני</h4>
              <span>כדי להבין את התמונה המלאה</span>
            </div>
            <div className="workspace-rich-text-grid">
              <article className="workspace-rich-card">
                <span>תקציר קליטה</span>
                <strong>{patient.intake_summary ?? "אין תקציר פתיחה עדיין"}</strong>
              </article>
              <article className="workspace-rich-card">
                <span>רקע רפואי</span>
                <strong>{patient.medical_background ?? "לא הוזן רקע רפואי"}</strong>
              </article>
              <article className="workspace-rich-card">
                <span>תרופות</span>
                <strong>{patient.medications ?? "לא הוזנו תרופות"}</strong>
              </article>
              <article className="workspace-rich-card">
                <span>רגישויות / אלרגיות</span>
                <strong>{patient.allergies ?? "לא הוזנו רגישויות"}</strong>
              </article>
              <article className="workspace-rich-card full-width">
                <span>מצב תפקודי</span>
                <strong>{patient.functional_status ?? "לא הוזן מצב תפקודי"}</strong>
              </article>
            </div>
          </section>

          <section className="workspace-panel-card">
            <div className="card-head">
              <h4>ניהול תיק</h4>
              <span>אדמיניסטרציה ויציבות תהליך</span>
            </div>
            <div className="workspace-overview-grid workspace-overview-grid-compact">
              {adminItems.map((item) => (
                <article key={item.label} className="workspace-overview-item tone-neutral">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "sessions" ? (
        <section className="workspace-panel-card">
          <div className="card-head">
            <h4>מפגשים</h4>
            <span>{appointments.length} רשומות</span>
          </div>
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>תאריך מפגש</th>
                  <th>סוג מפגש</th>
                  <th>מטפל</th>
                  <th>חדר</th>
                  <th>סטטוס</th>
                  <th>סיכום</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      {formatAppointmentDate(appointment.appointment_at)}{" "}
                      {formatAppointmentTime(appointment.appointment_at)}
                    </td>
                    <td>{appointment.summary?.includes("אבחון") ? "אבחון" : "טיפול"}</td>
                    <td>{therapistName}</td>
                    <td>{appointment.room ?? "לא הוגדר"}</td>
                    <td>{appointment.status}</td>
                    <td>{appointment.summary ?? "ללא סיכום"}</td>
                  </tr>
                ))}
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6}>עדיין אין מפגשים למטופל הזה.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className="workspace-panel-card">
          <div className="card-head">
            <h4>תיעוד קליני</h4>
            <span>{journalEntries.length} רשומות</span>
          </div>
          <div className="workspace-entry-list">
            {journalEntries.map((entry) => (
              <article key={entry.id} className="workspace-entry-card">
                <strong>{formatJournalDate(entry.entry_date)}</strong>
                <div className="preserve-lines">{entry.content}</div>
                {entry.home_program ? (
                  <div className="item-meta preserve-lines">
                    תרגול בית: {entry.home_program}
                  </div>
                ) : null}
              </article>
            ))}
            {journalEntries.length === 0 ? (
              <div className="empty-card">עדיין אין תיעוד קליני למטופל הזה.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "billing" ? (
        <section className="workspace-panel-card">
          <div className="card-head">
            <h4>תשלומים</h4>
            <span>מודול מקצועי בהקמה</span>
          </div>
          <div className="billing-placeholder-grid">
            <div className="workspace-overview-item tone-neutral">
              <span>חוב מטופל</span>
              <strong>{paymentBalance > 0 ? formatCurrency(paymentBalance) : "0 ש״ח"}</strong>
            </div>
            <div className="workspace-overview-item tone-neutral">
              <span>יתרת זכות</span>
              <strong>{paymentBalance < 0 ? formatCurrency(paymentBalance) : "0 ש״ח"}</strong>
            </div>
            <div className="workspace-overview-item tone-warn">
              <span>פעולה הבאה</span>
              <strong>{patient.insurance_provider ? "בדיקת זכאות והמשך חיוב" : "הוספת ledger ותשלומים"}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
