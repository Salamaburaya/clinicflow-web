create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'app_role'
  ) then
    create type app_role as enum ('admin', 'therapist', 'reception', 'finance');
  end if;
end
$$;

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  default_clinic_id uuid references clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role app_role not null default 'therapist',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists patient_care_team (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  therapist_id uuid not null references therapists (id) on delete cascade,
  access_level text not null default 'full',
  created_at timestamptz not null default now(),
  unique (patient_id, therapist_id)
);

alter table therapists
  add column if not exists clinic_id uuid references clinics (id) on delete set null,
  add column if not exists profile_user_id uuid references auth.users (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table patients
  add column if not exists clinic_id uuid references clinics (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table appointments
  add column if not exists clinic_id uuid references clinics (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table journal_entries
  add column if not exists clinic_id uuid references clinics (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create index if not exists idx_clinic_memberships_user_id
  on clinic_memberships (user_id);

create index if not exists idx_patients_clinic_id
  on patients (clinic_id);

create index if not exists idx_appointments_clinic_id
  on appointments (clinic_id);

create index if not exists idx_therapists_clinic_id
  on therapists (clinic_id);

create index if not exists idx_journal_entries_clinic_id
  on journal_entries (clinic_id);

create index if not exists idx_patient_care_team_patient_id
  on patient_care_team (patient_id);

create or replace function public.is_clinic_member(target_clinic_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from clinic_memberships membership
    where membership.clinic_id = target_clinic_id
      and membership.user_id = auth.uid()
      and membership.is_active = true
  );
$$;

create or replace function public.current_app_role(target_clinic_id uuid)
returns app_role
language sql
stable
as $$
  select membership.role
  from clinic_memberships membership
  where membership.clinic_id = target_clinic_id
    and membership.user_id = auth.uid()
    and membership.is_active = true
  limit 1;
$$;

alter table clinics enable row level security;
alter table user_profiles enable row level security;
alter table clinic_memberships enable row level security;
alter table patient_care_team enable row level security;

drop policy if exists "users can read own profile" on user_profiles;
create policy "users can read own profile"
  on user_profiles
  for select
  using (id = auth.uid());

drop policy if exists "users can update own profile" on user_profiles;
create policy "users can update own profile"
  on user_profiles
  for update
  using (id = auth.uid());

drop policy if exists "members can read memberships in clinic" on clinic_memberships;
create policy "members can read memberships in clinic"
  on clinic_memberships
  for select
  using (is_clinic_member(clinic_id));

drop policy if exists "admins manage memberships in clinic" on clinic_memberships;
create policy "admins manage memberships in clinic"
  on clinic_memberships
  for all
  using (current_app_role(clinic_id) = 'admin')
  with check (current_app_role(clinic_id) = 'admin');

drop policy if exists "members can read their clinics" on clinics;
create policy "members can read their clinics"
  on clinics
  for select
  using (is_clinic_member(id));

drop policy if exists "members can read patient care team in clinic" on patient_care_team;
create policy "members can read patient care team in clinic"
  on patient_care_team
  for select
  using (
    exists (
      select 1
      from patients
      where patients.id = patient_care_team.patient_id
        and is_clinic_member(patients.clinic_id)
    )
  );

drop policy if exists "admins manage patient care team in clinic" on patient_care_team;
create policy "admins manage patient care team in clinic"
  on patient_care_team
  for all
  using (
    exists (
      select 1
      from patients
      where patients.id = patient_care_team.patient_id
        and current_app_role(patients.clinic_id) = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from patients
      where patients.id = patient_care_team.patient_id
        and current_app_role(patients.clinic_id) = 'admin'
    )
  );

comment on table clinics is
  'Logical clinic/organization boundary for multi-tenant ClinicFlow.';

comment on table clinic_memberships is
  'Maps authenticated users to clinics and roles.';

comment on table patient_care_team is
  'Supports multiple therapists per patient with future access granularity.';
