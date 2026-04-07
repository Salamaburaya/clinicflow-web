type PaymentEntryStatus = "completed" | "pending" | "refunded";

export type StoredPaymentEntry = {
  id: string;
  patient_id: string;
  created_at: string;
  payment_date: string;
  amount: number;
  entry_kind?: "payment" | "charge";
  method: string;
  status: PaymentEntryStatus;
  category: string;
  note: string | null;
};

type PatientNotesEnvelope = {
  __clinicflow?: {
    version: 1;
    profile?: Partial<Record<(typeof patientProfileKeys)[number], string | null>>;
    billing?: {
      balance?: number | null;
      entries?: StoredPaymentEntry[];
    };
  };
  legacyText?: string | null;
};

const patientBaseKeys = [
  "full_name",
  "discipline",
  "status",
  "diagnosis",
  "treatment_goal",
  "therapist_id",
  "phone",
  "birth_date",
] as const;

const requiredPatientBaseKeys = new Set<string>(["full_name", "discipline", "status"]);

export const patientProfileKeys = [
  "email",
  "city",
  "settlement",
  "address",
  "gender",
  "title",
  "occupation",
  "referring_source",
  "communication_preference",
  "insurance_provider",
  "coverage_track",
  "attendance_risk",
  "preferred_days",
  "emergency_contact_name",
  "emergency_contact_phone",
  "allergies",
  "medications",
  "medical_background",
  "intake_summary",
  "functional_status",
] as const;

type PatientProfileKey = (typeof patientProfileKeys)[number];

const paymentStatuses = new Set<PaymentEntryStatus>(["completed", "pending", "refunded"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return value ?? null;
}

function parseEnvelope(notes: unknown): PatientNotesEnvelope | null {
  if (isRecord(notes) && isRecord(notes.__clinicflow)) {
    return notes as PatientNotesEnvelope;
  }

  if (typeof notes !== "string") {
    return null;
  }

  const trimmed = notes.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed) && isRecord(parsed.__clinicflow)) {
      return parsed as PatientNotesEnvelope;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeStoredPaymentEntry(
  patientId: string,
  value: unknown,
): StoredPaymentEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" && value.id.trim()
    ? value.id
    : "";
  const createdAt = typeof value.created_at === "string" && value.created_at.trim()
    ? value.created_at
    : "";
  const paymentDate = typeof value.payment_date === "string" && value.payment_date.trim()
    ? value.payment_date
    : createdAt;
  const amount = Number(value.amount ?? NaN);
  const method = typeof value.method === "string" && value.method.trim()
    ? value.method
    : "";
  const category = typeof value.category === "string" && value.category.trim()
    ? value.category
    : "";
  const status = typeof value.status === "string" && paymentStatuses.has(value.status as PaymentEntryStatus)
    ? (value.status as PaymentEntryStatus)
    : "completed";

  if (!id || !createdAt || !paymentDate || !Number.isFinite(amount) || !method || !category) {
    return null;
  }

  return {
    id,
    patient_id: typeof value.patient_id === "string" && value.patient_id.trim()
      ? value.patient_id
      : patientId,
    created_at: createdAt,
    payment_date: paymentDate,
    amount,
    entry_kind:
      value.entry_kind === "charge"
        ? "charge"
        : "payment",
    method,
    status,
    category,
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim() : null,
  };
}

export function parsePatientNotes(notes: unknown) {
  const envelope = parseEnvelope(notes);
  const legacyText =
    envelope && typeof envelope.legacyText === "string"
      ? envelope.legacyText
      : typeof notes === "string" && !envelope
        ? notes
        : null;

  const profile = isRecord(envelope?.__clinicflow?.profile)
    ? (envelope?.__clinicflow?.profile as Partial<
        Record<PatientProfileKey, string | null>
      >)
    : {};

  const billing = isRecord(envelope?.__clinicflow?.billing)
    ? envelope?.__clinicflow?.billing
    : undefined;

  return {
    legacyText,
    profile,
    paymentBalance:
      typeof billing?.balance === "number" && Number.isFinite(billing.balance)
        ? billing.balance
        : null,
    paymentEntries: Array.isArray(billing?.entries)
      ? billing.entries
      : [],
  };
}

export function buildPatientNotesValue(
  existingNotes: unknown,
  updates: {
    profile?: Partial<Record<PatientProfileKey, string | null>>;
    paymentBalance?: number | null;
    paymentEntries?: StoredPaymentEntry[];
  },
) {
  const current = parsePatientNotes(existingNotes);
  const nextProfile: Partial<Record<PatientProfileKey, string | null>> = {
    ...current.profile,
    ...(updates.profile ?? {}),
  };

  Object.keys(nextProfile).forEach((key) => {
    const typedKey = key as PatientProfileKey;
    const value = nextProfile[typedKey];
    if (typeof value === "string" && !value.trim()) {
      nextProfile[typedKey] = null;
    }
  });

  const hasProfile = Object.values(nextProfile).some(
    (value) => typeof value === "string" ? value.trim().length > 0 : value != null,
  );
  const nextPaymentEntries = updates.paymentEntries ?? current.paymentEntries;
  const hasPaymentEntries = nextPaymentEntries.length > 0;
  const nextPaymentBalance = updates.paymentBalance ?? current.paymentBalance;
  const hasPaymentBalance =
    typeof nextPaymentBalance === "number" && Number.isFinite(nextPaymentBalance);

  if (!hasProfile && !hasPaymentEntries && !hasPaymentBalance && !current.legacyText) {
    return null;
  }

  const envelope: PatientNotesEnvelope = {
    __clinicflow: {
      version: 1,
    },
  };

  if (hasProfile) {
    envelope.__clinicflow!.profile = nextProfile;
  }

  if (hasPaymentEntries || hasPaymentBalance) {
    envelope.__clinicflow!.billing = {
      balance: hasPaymentBalance ? nextPaymentBalance : 0,
      entries: nextPaymentEntries,
    };
  }

  if (current.legacyText) {
    envelope.legacyText = current.legacyText;
  }

  return JSON.stringify(envelope);
}

export function buildPatientServerPayload(
  payload: Record<string, unknown>,
  existingNotes?: unknown,
) {
  const basePayload: Record<string, unknown> = {};
  const profilePayload: Partial<Record<PatientProfileKey, string | null>> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if ((patientBaseKeys as readonly string[]).includes(key)) {
      const normalized = requiredPatientBaseKeys.has(key)
        ? value
        : normalizeOptionalValue(value);
      if (normalized !== undefined) {
        basePayload[key] = normalized;
      }
      return;
    }

    if ((patientProfileKeys as readonly string[]).includes(key)) {
      profilePayload[key as PatientProfileKey] = normalizeOptionalValue(value) as string | null;
    }
  });

  return {
    ...basePayload,
    notes: buildPatientNotesValue(existingNotes, { profile: profilePayload }),
  };
}

export function getPatientPaymentEntriesFromNotes(
  patientId: string,
  notes: unknown,
) {
  return parsePatientNotes(notes).paymentEntries
    .map((entry) => normalizeStoredPaymentEntry(patientId, entry))
    .filter((entry): entry is StoredPaymentEntry => Boolean(entry));
}

export function mergePaymentEntries(
  tableEntries: StoredPaymentEntry[],
  noteEntries: StoredPaymentEntry[],
) {
  const merged = new Map<string, StoredPaymentEntry>();

  [...tableEntries, ...noteEntries].forEach((entry) => {
    const existingEntry = merged.get(entry.id);
    merged.set(
      entry.id,
      existingEntry
        ? {
            ...existingEntry,
            ...entry,
            entry_kind: entry.entry_kind ?? existingEntry.entry_kind ?? "payment",
            note: entry.note ?? existingEntry.note ?? null,
          }
        : {
            ...entry,
            entry_kind: entry.entry_kind ?? "payment",
          },
    );
  });

  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left.payment_date).getTime();
    const rightTime = new Date(right.payment_date).getTime();

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function hydratePatientRow<T extends Record<string, unknown>>(row: T) {
  const parsed = parsePatientNotes(row.notes);

  return {
    ...row,
    ...Object.fromEntries(
      patientProfileKeys.map((key) => [key, parsed.profile[key] ?? null]),
    ),
    payment_balance:
      typeof parsed.paymentBalance === "number" && Number.isFinite(parsed.paymentBalance)
        ? parsed.paymentBalance
        : typeof row.payment_balance === "number" && Number.isFinite(row.payment_balance)
          ? row.payment_balance
          : 0,
  };
}

export function buildSeedPatientNotes(
  profile: Partial<Record<PatientProfileKey, string | null>>,
  paymentBalance: number | null | undefined,
  paymentEntries: StoredPaymentEntry[],
) {
  return buildPatientNotesValue(null, {
    profile,
    paymentBalance: paymentBalance ?? 0,
    paymentEntries,
  });
}

export function pickPatientProfileMetadata(record: Record<string, unknown>) {
  return Object.fromEntries(
    patientProfileKeys.map((key) => [key, normalizeOptionalValue(record[key])]),
  ) as Partial<Record<PatientProfileKey, string | null>>;
}

export function getPatientRollbackPayload(record: Record<string, unknown>) {
  return {
    full_name: record.full_name,
    discipline: record.discipline,
    status: record.status,
    diagnosis: record.diagnosis ?? null,
    treatment_goal: record.treatment_goal ?? null,
    therapist_id: record.therapist_id ?? null,
    phone: record.phone ?? null,
    birth_date: record.birth_date ?? null,
    notes: record.notes ?? null,
  };
}
