"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

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
};

type AddPatientForm = {
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string;
  treatment_goal: string;
};

type JournalForm = {
  status: string;
  diagnosis: string;
  goal: string;
  latestNote: string;
  homeProgram: string;
};

const defaultAddPatientForm: AddPatientForm = {
  full_name: "",
  discipline: "פיזיותרפיה",
  status: "חדש",
  diagnosis: "",
  treatment_goal: "",
};

const defaultJournalForm: JournalForm = {
  status: "חדש",
  diagnosis: "",
  goal: "",
  latestNote: "",
  homeProgram: "",
};

function buildJournalForm(patient?: Patient): JournalForm {
  if (!patient) {
    return defaultJournalForm;
  }

  return {
    status: patient.status,
    diagnosis: patient.diagnosis ?? "",
    goal: patient.treatment_goal ?? "",
    latestNote: "",
    homeProgram: "",
  };
}

function formatAppointmentTime(value: string) {
  return new Date(value).toLocaleString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJournalDate(value: string) {
  return new Date(value).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ClinicFlowApp({
  therapists,
  initialPatients,
  appointments,
}: ClinicFlowAppProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatients[0]?.id ?? "",
  );
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showPatientDialog, setShowPatientDialog] = useState(false);
  const [addPatientForm, setAddPatientForm] =
    useState<AddPatientForm>(defaultAddPatientForm);
  const [journalForm, setJournalForm] = useState<JournalForm>(() =>
    buildJournalForm(initialPatients[0]),
  );
  const [patientSaveStatus, setPatientSaveStatus] = useState("");
  const [journalSaveStatus, setJournalSaveStatus] = useState("");
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isSavingJournal, setIsSavingJournal] = useState(false);

  const therapistNameById = useMemo(
    () => new Map(therapists.map((therapist) => [therapist.id, therapist.full_name])),
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

  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];

  const filteredPatients = patients.filter((patient) =>
    [patient.full_name, patient.discipline, patient.status]
      .join(" ")
      .includes(search.trim()),
  );

  const stats = [
    {
      label: "מטופלים פעילים",
      value: patients.filter((patient) => patient.status === "בטיפול").length,
      note: "מטופלים שנמצאים כרגע בסדרה פעילה",
    },
    {
      label: "תורים קרובים",
      value: appointments.length,
      note: "רשומות שנשלפות מהיומן הקרוב",
    },
    {
      label: "מטופלים במעקב",
      value: patients.filter((patient) => patient.status === "מעקב").length,
      note: "דורשים חידוש סדרה או בדיקה נוספת",
    },
    {
      label: "צוות מקצועי",
      value: therapists.length,
      note: "מוחמד חאזקיה וחנין חאזקיה",
    },
  ];

  const tasks = [
    {
      title: "השלמת סיכומי טיפול",
      meta: "לעדכן את רשומות היומן של המפגשים האחרונים",
    },
    {
      title: "קביעת תורי המשך",
      meta: "מטופלים במעקב שעדיין לא נקבעה להם סדרה חדשה",
    },
    {
      title: "בדיקת תרגול בית",
      meta: "לעבור על ההמלצות שניתנו ולוודא מעקב",
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

  useEffect(() => {
    setPatients(initialPatients);
  }, [initialPatients]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    setJournalForm(buildJournalForm(selectedPatient));

    const loadEntries = async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("patient_id", selectedPatient.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        setJournalEntries([]);
        setJournalSaveStatus("לא ניתן לטעון את היסטוריית היומן כרגע");
        return;
      }

      setJournalEntries((data ?? []) as JournalEntry[]);
    };

    void loadEntries();
  }, [selectedPatient, selectedPatientId, supabase]);

  async function handleAddPatientSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAddingPatient(true);
    setPatientSaveStatus("");

    const therapistId =
      defaultTherapistByDiscipline.get(addPatientForm.discipline) ?? null;

    const { data, error } = await supabase
      .from("patients")
      .insert({
        full_name: addPatientForm.full_name.trim(),
        discipline: addPatientForm.discipline,
        status: addPatientForm.status,
        diagnosis: addPatientForm.diagnosis.trim() || null,
        treatment_goal: addPatientForm.treatment_goal.trim() || null,
        therapist_id: therapistId,
      })
      .select("*")
      .single();

    if (error || !data) {
      setIsAddingPatient(false);
      setPatientSaveStatus("הוספת המטופל נכשלה. צריך לאפשר כתיבה ב-Supabase.");
      return;
    }

    const insertedPatient = data as Patient;
    setPatients((current) => [insertedPatient, ...current]);
    setSelectedPatientId(insertedPatient.id);
    setAddPatientForm(defaultAddPatientForm);
    setShowPatientDialog(false);
    setActiveSection("patients");
    setIsAddingPatient(false);
  }

  async function handleJournalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      return;
    }

    setIsSavingJournal(true);
    setJournalSaveStatus("");

    const { data: updatedPatient, error: patientError } = await supabase
      .from("patients")
      .update({
        status: journalForm.status,
        diagnosis: journalForm.diagnosis.trim() || null,
        treatment_goal: journalForm.goal.trim() || null,
      })
      .eq("id", selectedPatient.id)
      .select("*")
      .single();

    if (patientError || !updatedPatient) {
      setIsSavingJournal(false);
      setJournalSaveStatus("שמירת תיק המטופל נכשלה");
      return;
    }

    let insertedEntry: JournalEntry | null = null;

    if (journalForm.latestNote.trim()) {
      const { data: journalData, error: journalError } = await supabase
        .from("journal_entries")
        .insert({
          patient_id: selectedPatient.id,
          therapist_id: selectedPatient.therapist_id,
          content: journalForm.latestNote.trim(),
          home_program: journalForm.homeProgram.trim() || null,
        })
        .select("*")
        .single();

      if (journalError) {
        setIsSavingJournal(false);
        setJournalSaveStatus("התיק נשמר, אבל לא ניתן היה לשמור את רשומת היומן");
        return;
      }

      insertedEntry = journalData as JournalEntry;
    }

    const nextPatient = updatedPatient as Patient;
    setPatients((current) =>
      current.map((patient) => (patient.id === nextPatient.id ? nextPatient : patient)),
    );
    setJournalForm(buildJournalForm(nextPatient));
    if (insertedEntry) {
      setJournalEntries((current) => [insertedEntry as JournalEntry, ...current]);
    }
    setIsSavingJournal(false);
    setJournalSaveStatus("היומן נשמר בהצלחה");
  }

  function handleSelectPatient(patientId: string) {
    setSelectedPatientId(patientId);
    setActiveSection("patients");
    setJournalSaveStatus("");
  }

  return (
    <>
      <main className="page-shell">
        <aside className="sidebar">
          <div>
            <p className="eyebrow">ClinicFlow</p>
            <h1>מכון לטיפול שמרגיש מסודר, אנושי וברור.</h1>
            <p className="intro">
              גרסה אינטרנטית לאפליקציה לניהול פיזיותרפיה וריפוי בעיסוק: מטופלים,
              תורים, צוות מטפל, סיכומי מפגש ומעקב התקדמות.
            </p>
          </div>

          <nav className="sidebar-nav">
            {[
              ["dashboard", "לוח בקרה"],
              ["patients", "מטופלים"],
              ["appointments", "יומן טיפולים"],
              ["team", "צוות"],
              ["reports", "דוחות"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`nav-link ${activeSection === key ? "active" : ""}`}
                data-section={key}
                onClick={() => setActiveSection(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>

          <section className="highlight-card">
            <span>פוקוס היום</span>
            <strong>האפליקציה חזרה למבנה המקורי שאהבת</strong>
            <p>הוספת מטופלים, עריכת יומן וסידור תפעולי באותו מסך.</p>
          </section>
        </aside>

        <section className="content">
          <section className="hero">
            <div>
              <p className="section-tag">תפעול יומי</p>
              <h2>ניהול תורים, תיעוד קליני ומעקב התקדמות במקום אחד</h2>
              <p>
                זה אותו מבנה עבודה של הגרסה המקומית הראשונה, רק מחובר למסד נתונים
                אמיתי ופתוח גם מהטלפון וגם מהמחשב.
              </p>
            </div>
            <div className="hero-actions">
              <button
                className="primary-btn"
                type="button"
                onClick={() => setShowPatientDialog(true)}
              >
                הוספת מטופל
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setActiveSection("appointments")}
              >
                מעבר ליומן
              </button>
            </div>
          </section>

          <section className={`panel ${activeSection === "dashboard" ? "active" : ""}`}>
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
                  <h3>טיפולים קרובים</h3>
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
                    </div>
                  ))}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>משימות צוות</h3>
                  <span>דורש תשומת לב</span>
                </div>
                <div className="stack-list">
                  {tasks.map((task) => (
                    <div key={task.title} className="list-item">
                      <strong>{task.title}</strong>
                      <div className="item-meta">{task.meta}</div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className={`panel ${activeSection === "patients" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">מאגר מטופלים</p>
                <h3>תיק מטופל עם סטטוס, אבחנה ויעדים טיפוליים</h3>
              </div>
              <input
                type="search"
                placeholder="חיפוש לפי שם, תחום או סטטוס"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="patients-grid">
              {filteredPatients.map((patient) => (
                <article key={patient.id} className="patient-card">
                  <div>
                    <strong>{patient.full_name}</strong>
                    <div className="chips">
                      <span className="chip">{patient.discipline}</span>
                      <span className="chip warm">{patient.status}</span>
                    </div>
                  </div>
                  <div>
                    <div className="item-meta">אבחנה</div>
                    <div>{patient.diagnosis ?? "טרם הוזנה אבחנה"}</div>
                  </div>
                  <div>
                    <div className="item-meta">יעד טיפולי</div>
                    <div>{patient.treatment_goal ?? "טרם הוזן יעד טיפולי"}</div>
                  </div>
                  <div className="item-meta">
                    מטפל אחראי: {therapistNameById.get(patient.therapist_id ?? "") ?? "לשיבוץ"}
                  </div>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => handleSelectPatient(patient.id)}
                  >
                    עריכת יומן המטופל
                  </button>
                </article>
              ))}
            </div>

            <article className="card journal-editor">
              <div className="section-head">
                <div>
                  <p className="section-tag">יומן מטופל</p>
                  <h3>עריכה מהירה של תיק קליני וסיכום טיפול</h3>
                </div>
                <select
                  value={selectedPatient?.id ?? ""}
                  onChange={(event) => handleSelectPatient(event.target.value)}
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name} | {patient.discipline}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPatient ? (
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
                    <button className="primary-btn" type="submit" disabled={isSavingJournal}>
                      {isSavingJournal ? "שומר..." : "שמירת יומן"}
                    </button>
                    <div className="item-meta">{journalSaveStatus}</div>
                  </div>
                </form>
              ) : null}

              <div className="journal-history">
                <div className="card-head">
                  <h4>היסטוריית יומן</h4>
                  <span>שלוש הרשומות האחרונות</span>
                </div>
                <div className="stack-list">
                  {journalEntries.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="list-item">
                      <strong>{formatJournalDate(entry.entry_date)}</strong>
                      <div>{entry.content}</div>
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
            </article>
          </section>

          <section className={`panel ${activeSection === "appointments" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">יומן</p>
                <h3>תורים, מטפל אחראי וחדר טיפול</h3>
              </div>
            </div>
            <div className="timeline">
              {appointments.map((appointment) => (
                <article key={appointment.id} className="timeline-item">
                  <div className="time-block">{formatAppointmentTime(appointment.appointment_at)}</div>
                  <div>
                    <strong>
                      {patients.find((patient) => patient.id === appointment.patient_id)?.full_name ??
                        "מטופל לא ידוע"}
                    </strong>
                    <div className="chips">
                      <span className="chip">
                        {patients.find((patient) => patient.id === appointment.patient_id)?.discipline ??
                          "ללא תחום"}
                      </span>
                      <span className="chip warm">{appointment.room ?? "חדר לא הוגדר"}</span>
                      <span className="chip chip-muted">
                        {therapistNameById.get(appointment.therapist_id ?? "") ?? "ללא מטפל"}
                      </span>
                    </div>
                    <p>{appointment.summary ?? "טרם נכתב סיכום טיפול"}</p>
                  </div>
                </article>
              ))}
              {appointments.length === 0 ? (
                <div className="empty-card">עדיין אין תורים במסד הנתונים.</div>
              ) : null}
            </div>
          </section>

          <section className={`panel ${activeSection === "team" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">צוות מקצועי</p>
                <h3>עומסים, זמינות והתמחויות</h3>
              </div>
            </div>
            <div className="team-grid">
              {therapists.map((therapist) => (
                <article key={therapist.id} className="team-card">
                  <div>
                    <strong>{therapist.full_name}</strong>
                    <div className="item-meta">{therapist.profession}</div>
                  </div>
                  <div>{therapist.specialty ?? "ללא התמחות מוגדרת"}</div>
                  <div className="chips">
                    <span className="chip">צוות פעיל</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={`panel ${activeSection === "reports" ? "active" : ""}`}>
            <div className="section-head">
              <div>
                <p className="section-tag">מדדים</p>
                <h3>תמונת מצב מהירה להנהלה</h3>
              </div>
            </div>
            <div className="reports-grid">
              <article className="card">
                <h4>פילוח טיפולים</h4>
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
        <div className="dialog-backdrop" onClick={() => setShowPatientDialog(false)}>
          <div className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <form className="dialog-form" onSubmit={handleAddPatientSubmit}>
              <div className="dialog-head">
                <h3>הוספת מטופל</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPatientDialog(false)}
                >
                  סגירה
                </button>
              </div>

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

              <label>
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

              <div className="dialog-actions">
                <button className="primary-btn" type="submit" disabled={isAddingPatient}>
                  {isAddingPatient ? "שומר..." : "שמירת מטופל"}
                </button>
                <div className="item-meta">{patientSaveStatus}</div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
