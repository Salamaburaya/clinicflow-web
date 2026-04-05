create extension if not exists pgcrypto;

create table if not exists note_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics (id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  discipline text,
  schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics (id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  audience text not null default 'patient',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_template_id uuid not null references questionnaire_templates (id) on delete cascade,
  position integer not null default 0,
  question_key text not null,
  label text not null,
  field_type text not null default 'textarea',
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  unique (questionnaire_template_id, question_key)
);

create table if not exists questionnaire_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  questionnaire_template_id uuid not null references questionnaire_templates (id) on delete restrict,
  status text not null default 'draft',
  sent_at timestamptz,
  completed_at timestamptz,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  questionnaire_request_id uuid not null references questionnaire_requests (id) on delete cascade,
  question_key text not null,
  answer_text text,
  answer_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionnaire_request_id, question_key)
);

create index if not exists idx_note_templates_clinic_id
  on note_templates (clinic_id);

create index if not exists idx_questionnaire_templates_clinic_id
  on questionnaire_templates (clinic_id);

create index if not exists idx_questionnaire_requests_patient_id
  on questionnaire_requests (patient_id);

create index if not exists idx_questionnaire_requests_appointment_id
  on questionnaire_requests (appointment_id);

comment on table note_templates is
  'Clinic-scoped smart note template definitions for structured documentation.';

comment on table questionnaire_templates is
  'Reusable clinic questionnaire definitions.';

comment on table questionnaire_requests is
  'Tracks sending and completion lifecycle of questionnaires per patient.';
