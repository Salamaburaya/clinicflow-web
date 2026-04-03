alter table appointments
  add column if not exists patient_confirmation_sent_at timestamptz,
  add column if not exists therapist_confirmation_sent_at timestamptz,
  add column if not exists patient_reminder_24h_sent_at timestamptz,
  add column if not exists therapist_reminder_24h_sent_at timestamptz,
  add column if not exists patient_reminder_1h_sent_at timestamptz,
  add column if not exists therapist_reminder_1h_sent_at timestamptz;
