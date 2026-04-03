export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) {
    return "";
  }

  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits.slice(1);
  }
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  if (digits.startsWith("0")) {
    return `972${digits.slice(1)}`;
  }
  return digits;
}

export function toWhatsAppAddress(phone?: string | null) {
  const normalized = normalizeWhatsAppPhone(phone);
  return normalized ? `whatsapp:+${normalized}` : "";
}
