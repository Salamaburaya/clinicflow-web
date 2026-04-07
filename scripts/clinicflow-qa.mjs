const baseUrl = process.env.CLINICFLOW_QA_BASE_URL || "https://clinicflow-web-alpha.vercel.app";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function postMutation(body) {
  const result = await request("/api/clinicflow/mutate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return result;
}

async function expectOk(label, body) {
  const { response, json, text } = await postMutation(body);
  assert(response.ok, `${label} expected HTTP 200, got ${response.status}: ${text}`);
  assert(json?.ok === true, `${label} expected ok=true, got: ${text}`);
  return json;
}

async function expectError(label, body, status) {
  const { response, json, text } = await postMutation(body);
  assert(response.status === status, `${label} expected HTTP ${status}, got ${response.status}: ${text}`);
  assert(json?.ok === false, `${label} expected ok=false, got: ${text}`);
  return json;
}

async function getPatientRecord(patientId) {
  const { response, json, text } = await request(
    `/api/clinicflow/patient-record?patientId=${encodeURIComponent(patientId)}`,
  );

  assert(response.ok, `patient-record expected HTTP 200, got ${response.status}: ${text}`);
  assert(json?.ok === true, `patient-record expected ok=true, got: ${text}`);
  return json;
}

async function run() {
  console.log(`ClinicFlow QA starting against ${baseUrl}`);

  await expectError("missing patientId", { action: "deletePatient" }, 404);
  await expectError(
    "invalid patient id",
    { action: "deletePatient", patientId: "not-a-real-patient" },
    404,
  );
  await expectError(
    "invalid payment id",
    {
      action: "updatePayment",
      paymentId: "missing",
      patientId: "missing",
      amount: 1,
      method: "cash",
      category: "manual",
      note: "",
    },
    400,
  );
  await expectError(
    "missing patient name",
    {
      action: "savePatient",
      payload: { full_name: "", discipline: "פיזיותרפיה", status: "חדש" },
    },
    400,
  );
  await expectError(
    "invalid patient status",
    {
      action: "savePatient",
      payload: { full_name: "בדיקה", discipline: "פיזיותרפיה", status: "invalid-status" },
    },
    400,
  );
  await expectError(
    "missing therapist profession",
    { action: "saveTherapist", payload: { full_name: "בדיקה", profession: "" } },
    400,
  );
  await expectError(
    "missing appointment date",
    {
      action: "saveAppointment",
      payload: {
        patient_id: "seed-patient-noa",
        therapist_id: "",
        appointment_at: "",
        room: "1",
        status: "scheduled",
        summary: "x",
        type: "טיפול",
      },
    },
    400,
  );
  await expectError(
    "invalid payment amount",
    {
      action: "savePayment",
      patientId: "seed-patient-noa",
      amount: 0,
      method: "cash",
      category: "manual",
      note: "",
    },
    400,
  );

  const now = Date.now();
  const therapist = await expectOk("create therapist", {
    action: "saveTherapist",
    payload: {
      full_name: `מטפל QA ${now}`,
      profession: "פיזיותרפיה",
      specialty: "QA",
      phone: "0507000201",
    },
  });

  const patient = await expectOk("create patient", {
    action: "savePatient",
    payload: {
      full_name: `מטופל QA ${now}`,
      discipline: "פיזיותרפיה",
      status: "active",
      diagnosis: "qa",
      treatment_goal: "qa goal",
      therapist_id: therapist.therapist.id,
      phone: "0507000202",
    },
  });

  assert(patient.patient.status === "בטיפול", "patient status should normalize to בטיפול");

  const journal = await expectOk("save journal", {
    action: "saveJournal",
    patientId: patient.patient.id,
    patientPayload: {
      full_name: `מטופל QA ${now}`,
      discipline: "פיזיותרפיה",
      status: "בטיפול",
      diagnosis: "qa updated",
      therapist_id: therapist.therapist.id,
    },
    journalPayload: {
      content: "QA note\nשרת עובד",
      home_program: "תרגול בית",
      therapist_id: therapist.therapist.id,
      created_at: new Date().toISOString(),
    },
  });

  assert(Boolean(journal.journalEntry?.id), "journal entry should be created");

  const appointment = await expectOk("create appointment", {
    action: "saveAppointment",
    payload: {
      patient_id: patient.patient.id,
      therapist_id: therapist.therapist.id,
      appointment_at: new Date(Date.now() + 3600000).toISOString(),
      room: "5",
      status: "scheduled",
      summary: "qa appointment",
      type: "טיפול",
    },
  });

  const payment = await expectOk("create payment", {
    action: "savePayment",
    patientId: patient.patient.id,
    amount: 150,
    method: "cash",
    category: "manual",
    note: "qa valid",
  });

  const updatedPayment = await expectOk("update payment", {
    action: "updatePayment",
    paymentId: payment.paymentEntry.id,
    patientId: patient.patient.id,
    amount: 175,
    method: "transfer",
    category: "manual",
    note: "qa updated",
  });

  assert(updatedPayment.paymentEntry.amount === 175, "payment amount should update");

  const updatedStatus = await expectOk("update patient status", {
    action: "updatePatientStatus",
    patientId: patient.patient.id,
    status: "followup",
  });

  assert(updatedStatus.patient.status === "מעקב", "patient status should normalize to מעקב");

  const record = await getPatientRecord(patient.patient.id);
  assert(record.patient?.id === patient.patient.id, "patient-record should load the created patient");
  assert((record.journalEntries ?? []).length > 0, "patient-record should include journal entries");
  assert((record.appointments ?? []).length > 0, "patient-record should include appointments");
  assert((record.paymentEntries ?? []).length > 0, "patient-record should include payment entries");

  await expectOk("delete payment", {
    action: "deletePayment",
    patientId: patient.patient.id,
    paymentId: payment.paymentEntry.id,
  });

  await expectOk("delete appointment", {
    action: "deleteAppointment",
    appointmentId: appointment.appointment.id,
  });

  await expectOk("delete patient", {
    action: "deletePatient",
    patientId: patient.patient.id,
  });

  await expectOk("delete therapist", {
    action: "deleteTherapist",
    therapistId: therapist.therapist.id,
  });

  console.log("ClinicFlow QA passed");
}

run().catch((error) => {
  console.error("ClinicFlow QA failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
