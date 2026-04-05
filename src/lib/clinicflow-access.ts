export type AppRole = "admin" | "therapist" | "reception" | "finance";

export type AppSection =
  | "dashboard"
  | "patients"
  | "appointments"
  | "team"
  | "reports";

export type AccessContext = {
  clinicName: string;
  displayName: string;
  role: AppRole;
};

type SectionDefinition = {
  key: AppSection;
  label: string;
  roles: AppRole[];
};

const sectionDefinitions: SectionDefinition[] = [
  {
    key: "dashboard",
    label: "לוח בקרה",
    roles: ["admin", "therapist", "reception", "finance"],
  },
  {
    key: "patients",
    label: "מטופלים",
    roles: ["admin", "therapist", "reception"],
  },
  {
    key: "appointments",
    label: "יומן טיפולים",
    roles: ["admin", "therapist", "reception"],
  },
  {
    key: "team",
    label: "צוות",
    roles: ["admin"],
  },
  {
    key: "reports",
    label: "דוחות",
    roles: ["admin", "finance"],
  },
];

const roleLabels: Record<AppRole, string> = {
  admin: "מנהל/ת",
  therapist: "מטפל/ת",
  reception: "קבלה",
  finance: "כספים",
};

export const defaultAccessContext: AccessContext = {
  clinicName: "ClinicFlow",
  displayName: "צוות קליניקה",
  role: "admin",
};

export function getRoleLabel(role: AppRole) {
  return roleLabels[role];
}

export function getVisibleSections(role: AppRole) {
  return sectionDefinitions.filter((section) => section.roles.includes(role));
}

export function canManageTeam(role: AppRole) {
  return role === "admin";
}

export function canViewReports(role: AppRole) {
  return role === "admin" || role === "finance";
}

export function canManagePatients(role: AppRole) {
  return role === "admin" || role === "therapist" || role === "reception";
}

export function canEditClinicalNotes(role: AppRole) {
  return role === "admin" || role === "therapist";
}

export function canManageAppointments(role: AppRole) {
  return role === "admin" || role === "therapist" || role === "reception";
}

export function canManageBilling(role: AppRole) {
  return role === "admin" || role === "reception" || role === "finance";
}
