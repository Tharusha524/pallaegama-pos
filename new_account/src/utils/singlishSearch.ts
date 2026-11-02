import { transliterate as singlishToSinhala } from "singlish-pro";
import { foldSinhala, foldedWordsMatch, plainSinglish } from "./sinhalaFold";

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

/**
 * Adds items from `all` whose name is a close spelling of the search
 * ("renuka" -> රේණුකා) after the exact matches, which stay on top.
 */
export function appendCloseMatches<T extends { stock_id?: unknown; description?: unknown }>(all: T[], exact: T[], text: string): T[] {
  const typed = text.trim();
  if (typed.length < 3) return exact;
  const folded = foldSinhala(toSinhalaSearch(plainSinglish(typed)));
  if (!folded) return exact;
  const seen = new Set(exact.map((o) => String(o.stock_id)));
  return [...exact, ...all.filter((o) => !seen.has(String(o.stock_id)) && foldedWordsMatch(folded, foldSinhala(String(o.description ?? ""))))];
}
