import { createHash } from "node:crypto";

export const CLINICFLOW_ACCESS_COOKIE = "clinicflow_access";
export const CLINICFLOW_UNLOCK_PATH = "/unlock";

function getClinicAccessPassword() {
  return process.env.CLINICFLOW_ACCESS_PASSWORD?.trim() ?? "";
}

function getClinicAccessSecret() {
  return (
    process.env.CLINICFLOW_SESSION_SECRET?.trim()
    || process.env.CLINICFLOW_ACCESS_PASSWORD?.trim()
    || "clinicflow-access"
  );
}

export function isClinicAccessEnabled() {
  return getClinicAccessPassword().length > 0;
}

export function createClinicAccessToken() {
  const password = getClinicAccessPassword();

  if (!password) {
    return "";
  }

  return createHash("sha256")
    .update(`${password}:${getClinicAccessSecret()}`)
    .digest("hex");
}

export function isValidClinicAccessToken(value?: string | null) {
  if (!isClinicAccessEnabled()) {
    return true;
  }

  if (!value) {
    return false;
  }

  return value === createClinicAccessToken();
}

export function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(prefix.length));
}

export function requestHasClinicAccess(request: Request | { headers: Headers }) {
  if (!isClinicAccessEnabled()) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie");
  const value = readCookieValue(cookieHeader, CLINICFLOW_ACCESS_COOKIE);
  return isValidClinicAccessToken(value);
}

export function buildClinicAccessCookieValue() {
  return createClinicAccessToken();
}

