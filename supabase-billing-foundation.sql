create extension if not exists pgcrypto;

create table if not exists public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now(),
  payment_date timestamptz not null default now(),
  amount numeric(10, 2) not null check (amount > 0),
  method text not null,
  status text not null default 'completed' check (status in ('completed', 'pending', 'refunded')),
  category text not null,
  note text
);

create index if not exists payment_entries_patient_id_idx
  on public.payment_entries (patient_id);

create index if not exists payment_entries_payment_date_idx
  on public.payment_entries (payment_date desc);
