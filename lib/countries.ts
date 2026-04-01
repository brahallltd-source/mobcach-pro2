export const COUNTRY_OPTIONS = [
  { value: "Morocco", label: "Morocco", dialCode: "+212" },
  { value: "Algeria", label: "Algeria", dialCode: "+213" },
  { value: "Tunisia", label: "Tunisia", dialCode: "+216" },
  { value: "France", label: "France", dialCode: "+33" },
  { value: "Spain", label: "Spain", dialCode: "+34" },
  { value: "Italy", label: "Italy", dialCode: "+39" },
  { value: "Belgium", label: "Belgium", dialCode: "+32" },
  { value: "Germany", label: "Germany", dialCode: "+49" },
  { value: "Netherlands", label: "Netherlands", dialCode: "+31" },
  { value: "United Kingdom", label: "United Kingdom", dialCode: "+44" },
  { value: "United States", label: "United States", dialCode: "+1" },
  { value: "Canada", label: "Canada", dialCode: "+1" }
];

export function getDialCode(country: string) {
  return COUNTRY_OPTIONS.find((item) => item.value === country)?.dialCode || "";
}

export function normalizePhoneWithCountry(rawPhone: string, country: string) {
  const dial = getDialCode(country);
  const digits = String(rawPhone || "").replace(/\s+/g, "");
  if (!digits) return dial;
  if (digits.startsWith("+")) return digits;
  if (!dial) return digits;
  return digits.startsWith("0") ? `${dial}${digits.slice(1)}` : `${dial}${digits}`;
}
