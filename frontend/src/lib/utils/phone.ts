/**
 * Indian phone number helpers.
 *
 * Backend (shipment-service/validation/shipmentSchemas.js) enforces /^\+91[0-9]{10}$/
 * on every phone field. These helpers keep the frontend forgiving on input while
 * guaranteeing the backend contract at submit time.
 */

export function sanitizeIndianPhone(raw: string): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D+/g, "");
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return digits.slice(0, 10);
}

export function isValidIndianPhone(raw: string): boolean {
  const s = sanitizeIndianPhone(raw);
  return /^[6-9]\d{9}$/.test(s);
}

export function toE164Indian(raw: string): string {
  const s = sanitizeIndianPhone(raw);
  return s.length === 10 ? `+91${s}` : "";
}
