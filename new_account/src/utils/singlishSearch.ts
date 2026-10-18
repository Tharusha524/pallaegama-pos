import { transliterate as singlishToSinhala } from "singlish-pro";

/**
 * Sinhala version of a Singlish search term ("parippu" → "පරිප්පු"), or ""
 * when there is nothing to convert (numbers, barcodes, already-Sinhala text).
 */
export function toSinhalaSearch(text: string): string {
  const typed = text.trim();
  if (!typed || !/[a-zA-Z]/.test(typed)) return "";
  let converted = "";
  try { converted = singlishToSinhala(typed, { finalize: true }); } catch { /* ignore */ }
  return /[඀-෿]/.test(converted) && converted !== typed ? converted : "";
}
