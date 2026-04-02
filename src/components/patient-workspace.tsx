"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

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

type JournalEntry = {
  id: string;
  patient_id: string;
  therapist_id: string | null;
  entry_date: string;
  content: string;
  home_program: string | null;
  created_at: string;
};

type PatientWorkspaceProps = {
  initialPatients: Patient[];
  therapists: Therapist[];
};

type AddPatientForm = {
  full_name: string;
  discipline: string;
  status: string;
  diagnosis: string;
  treatment_goal: string;
  therapist_id: string;
};

type JournalForm = {
  status: string;
  diagnosis: string;
  treatment_goal: string;
  therapist_id: string;
  latestNote: string;
  homeProgram: string;
};

const defaultAddPatientForm: AddPatientForm = {
  full_name: "",
  discipline: "פיזיותרפיה",
  status: "חדש",
  diagnosis: "",
  treatment_goal: "",
  therapist_id: "",
};

const defaultJournalForm: JournalForm = {
  status: "חדש",
  diagnosis: "",
  treatment_goal: "",
  therapist_id: "",
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
    treatment_goal: patient.treatment_goal ?? "",
    therapist_id: patient.therapist_id ?? "",
    latestNote: "",
    homeProgram: "",
  };
}

function formatEntryDate(value: string) {
  return new Date(value).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function PatientWorkspace({
  initialPatients,
  therapists,
}: PatientWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [patients, setPatients] = useState(initialPatients);
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatients[0]?.id ?? "",
  );
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [addPatientForm, setAddPatientForm] =
    useState<AddPatientForm>(defaultAddPatientForm);
  const [journalForm, setJournalForm] = useState<JournalForm>(() =>
    buildJournalForm(initialPatients[0]),
  );
  const [addStatus, setAddStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const therapistByDiscipline = useMemo(() => {
    const map = new Map<string, string>();
    therapists.forEach((therapist) => {
      if (!map.has(therapist.profession)) {
        map.set(therapist.profession, therapist.id);
      }
    });
    return map;
  }, [therapists]);

  const selectedPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    const loadEntries = async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("patient_id", selectedPatient.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        setSaveStatus("לא ניתן לטעון את יומן הטיפול כרגע");
        setJournalEntries([]);
        return;
      }

      setJournalEntries((data ?? []) as JournalEntry[]);
    };

    void loadEntries();
  }, [selectedPatient, supabase]);

  function handleSelectPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setSelectedPatientId(patientId);
    setJournalForm(buildJournalForm(patient));
    setSaveStatus("");
  }

  function refreshServerData() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleAddPatientSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAdding(true);
    setAddStatus("");

    const therapistId =
      addPatientForm.therapist_id ||
      therapistByDiscipline.get(addPatientForm.discipline) ||
      null;

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
      setIsAdding(false);
      setAddStatus("שמירת המטופל נכשלה. בדוק שהטבלאות פתוחות לגישה ב-Supabase.");
      return;
    }

    const insertedPatient = data as Patient;
    const nextPatients = [insertedPatient, ...patients];
    setPatients(nextPatients);
    setSelectedPatientId(insertedPatient.id);
    setJournalForm(buildJournalForm(insertedPatient));
    setJournalEntries([]);
    setAddPatientForm({
      ...defaultAddPatientForm,
      discipline: addPatientForm.discipline,
      therapist_id: therapistId ?? "",
    });
    setAddStatus("המטופל נוסף בהצלחה");
    setIsAdding(false);
    refreshServerData();
  }

  async function handleJournalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) {
      return;
    }

    setIsSaving(true);
    setSaveStatus("");

    const { data: updatedPatient, error: updateError } = await supabase
      .from("patients")
      .update({
        status: journalForm.status,
        diagnosis: journalForm.diagnosis.trim() || null,
        treatment_goal: journalForm.treatment_goal.trim() || null,
        therapist_id: journalForm.therapist_id || null,
      })
      .eq("id", selectedPatient.id)
      .select("*")
      .single();

    if (updateError || !updatedPatient) {
      setIsSaving(false);
      setSaveStatus("עדכון תיק המטופל נכשל");
      return;
    }

    let nextEntries = journalEntries;

    if (journalForm.latestNote.trim()) {
      const { data: insertedEntry, error: insertError } = await supabase
        .from("journal_entries")
        .insert({
          patient_id: selectedPatient.id,
          therapist_id: journalForm.therapist_id || null,
          content: journalForm.latestNote.trim(),
          home_program: journalForm.homeProgram.trim() || null,
        })
        .select("*")
        .single();

      if (insertError) {
        setIsSaving(false);
        setSaveStatus("תיק המטופל נשמר, אבל לא ניתן היה לשמור את רשומת היומן");
        return;
      }

      nextEntries = [insertedEntry as JournalEntry, ...journalEntries];
      setJournalEntries(nextEntries);
    }

    const updated = updatedPatient as Patient;
    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.id === updated.id ? updated : patient,
      ),
    );
    setJournalForm(buildJournalForm(updated));
    setSaveStatus("תיק המטופל והיומן נשמרו בהצלחה");
    setIsSaving(false);
    refreshServerData();
  }

  return (
    <section id="patients" className="panel workspace-panel">
      <div className="section-head">
        <div>
          <p className="section-tag">מטופלים</p>
          <h3>הוספה ועריכה של מטופלים ויומן טיפול</h3>
        </div>
        <span className="muted">מחובר ישירות ל-Supabase</span>
      </div>

      <div className="workspace-grid">
        <article className="panel form-panel">
          <div className="panel-head">
            <h3>הוספת מטופל</h3>
            <span className="muted">טבלה `patients`</span>
          </div>

          <form className="form-grid" onSubmit={handleAddPatientSubmit}>
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
              תחום
              <select
                value={addPatientForm.discipline}
                onChange={(event) =>
                  setAddPatientForm((current) => ({
                    ...current,
                    discipline: event.target.value,
                    therapist_id:
                      therapistByDiscipline.get(event.target.value) ?? "",
                  }))
                }
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
              >
                <option value="חדש">חדש</option>
                <option value="בטיפול">בטיפול</option>
                <option value="מעקב">מעקב</option>
              </select>
            </label>

            <label>
              מטפל אחראי
              <select
                value={addPatientForm.therapist_id}
                onChange={(event) =>
                  setAddPatientForm((current) => ({
                    ...current,
                    therapist_id: event.target.value,
                  }))
                }
              >
                <option value="">שיבוץ אוטומטי לפי תחום</option>
                {therapists.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="full-span">
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

            <label className="full-span">
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
              />
            </label>

            <div className="form-actions full-span">
              <button className="btn primary" type="submit" disabled={isAdding}>
                {isAdding ? "שומר..." : "הוספת מטופל"}
              </button>
              <span className="muted">{addStatus}</span>
            </div>
          </form>
        </article>

        <article className="panel form-panel">
          <div className="panel-head">
            <h3>עריכת תיק ויומן</h3>
            <span className="muted">טבלאות `patients` ו-`journal_entries`</span>
          </div>

          {patients.length === 0 ? (
            <div className="empty">עדיין אין מטופלים במערכת. אפשר להתחיל מהטופס בצד.</div>
          ) : (
            <>
              <label className="form-field">
                בחירת מטופל
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
              </label>

              <form className="form-grid" onSubmit={handleJournalSubmit}>
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
                  >
                    <option value="חדש">חדש</option>
                    <option value="בטיפול">בטיפול</option>
                    <option value="מעקב">מעקב</option>
                  </select>
                </label>

                <label>
                  מטפל אחראי
                  <select
                    value={journalForm.therapist_id}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        therapist_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">ללא מטפל</option>
                    {therapists.map((therapist) => (
                      <option key={therapist.id} value={therapist.id}>
                        {therapist.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full-span">
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
                  />
                </label>

                <label className="full-span">
                  יעד טיפולי
                  <textarea
                    rows={3}
                    value={journalForm.treatment_goal}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        treatment_goal: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="full-span">
                  סיכום מפגש חדש
                  <textarea
                    rows={5}
                    value={journalForm.latestNote}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        latestNote: event.target.value,
                      }))
                    }
                    placeholder="מה קרה במפגש, התקדמות, הערות קליניות..."
                  />
                </label>

                <label className="full-span">
                  תרגילים לבית / המלצות
                  <textarea
                    rows={3}
                    value={journalForm.homeProgram}
                    onChange={(event) =>
                      setJournalForm((current) => ({
                        ...current,
                        homeProgram: event.target.value,
                      }))
                    }
                    placeholder="תרגילים, הנחיות להורים, המלצות להמשך"
                  />
                </label>

                <div className="form-actions full-span">
                  <button className="btn primary" type="submit" disabled={isSaving}>
                    {isSaving ? "שומר..." : "שמירת תיק ויומן"}
                  </button>
                  <span className="muted">{saveStatus}</span>
                </div>
              </form>

              <div className="history-block">
                <div className="panel-head">
                  <h3>היסטוריית יומן</h3>
                  <span className="muted">6 רשומות אחרונות</span>
                </div>
                {journalEntries.length === 0 ? (
                  <div className="empty">עדיין אין רשומות יומן למטופל הזה.</div>
                ) : (
                  <div className="stack">
                    {journalEntries.map((entry) => (
                      <article key={entry.id} className="list-item">
                        <strong>{formatEntryDate(entry.entry_date)}</strong>
                        <div>{entry.content}</div>
                        {entry.home_program ? (
                          <div className="muted">תרגול בית: {entry.home_program}</div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </article>
      </div>

      <div className="patient-grid">
        {patients.map((patient) => {
          const therapistName =
            therapists.find((therapist) => therapist.id === patient.therapist_id)
              ?.full_name ?? "טרם שובץ";

          return (
            <article key={patient.id} className="person-card">
              <strong>{patient.full_name}</strong>
              <div className="muted">{patient.diagnosis ?? "אין אבחנה כרגע"}</div>
              <div className="chips">
                <span className="chip">{patient.discipline}</span>
                <span className="chip warm">{patient.status}</span>
              </div>
              <p className="muted">
                {patient.treatment_goal ?? "אין יעד טיפולי שהוזן עדיין"}
              </p>
              <div className="item-row">
                <span className="muted">מטפל אחראי: {therapistName}</span>
                <button
                  className="btn"
                  type="button"
                  onClick={() => handleSelectPatient(patient.id)}
                >
                  עריכת תיק
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
