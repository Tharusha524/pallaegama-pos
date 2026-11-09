import { transliterate as singlishToSinhala } from "singlish-pro";
import { foldSinhala, foldedWordsMatch, plainSinglish } from "./sinhalaFold";
import { lookupBarcode } from "../api/Pos/posApi";

// The POS checkout item search, shared by every item search box:
// item code first, then name / code text, Singlish ("kiri" -> කිරි),
// and close Sinhala spellings last. Barcodes are looked up on Enter.

export type ItemCodeOf = (o: any) => string;
export type ItemTextOf = (o: any) => string;

export const defaultCodeOf: ItemCodeOf = (o) => String(o?.stock_id ?? o?.stk_code ?? o?.item_code ?? "").trim();
export const defaultTextOf: ItemTextOf = (o) => String(o?.description ?? o?.name ?? "");

export function searchItems<T>(
  options: T[],
  inputValue: string,
  codeOf: ItemCodeOf = defaultCodeOf,
  textOf: ItemTextOf = defaultTextOf,
): T[] {
  const typed = (inputValue ?? "").trim();
  if (!typed) return options;
  const raw = typed.toLowerCase();
  let sinhala = "";
  try { sinhala = singlishToSinhala(typed, { finalize: true }); } catch { /* ignore */ }

  const codeExact: T[] = [];
  const codeStart: T[] = [];
  const textMatch: T[] = [];
  for (const o of options) {
    const code = codeOf(o).toLowerCase();
    if (code === raw) { codeExact.push(o); continue; }
    if (code && code.startsWith(raw)) { codeStart.push(o); continue; }
    const label = `${code} ${textOf(o)}`.toLowerCase();
    const barcode = String((o as any)?.barcode ?? "");
    if (label.includes(raw) || (sinhala && label.includes(sinhala)) || (barcode && barcode.includes(typed))) textMatch.push(o);
  }
  const found = [...codeExact, ...codeStart, ...textMatch];

  // Close spellings ("renuka" -> රේණුකා) come after the direct matches.
  let plain = sinhala;
  try { plain = singlishToSinhala(plainSinglish(typed), { finalize: true }); } catch { /* ignore */ }
  const foldedSearch = foldSinhala(plain);
  if (typed.length < 3 || !foldedSearch) return found;
  const seen = new Set(found);
  const close = options.filter((o) => !seen.has(o) && foldedWordsMatch(foldedSearch, foldSinhala(textOf(o))));
  return [...found, ...close];
}

/** A typed / scanned item code or barcode (Enter on it picks the item). */
export const looksLikeCode = (text: string) => /^\d{4,}$/.test(text.trim());

/**
 * Item(s) for a code: an exact item code from the list, else a barcode looked
 * up on the server. Returns the matching options from the list ([] = none).
 */
export async function findItemsByCode<T>(
  code: string,
  options: T[],
  codeOf: ItemCodeOf = defaultCodeOf,
): Promise<T[]> {
  const c = code.trim();
  const exact = options.filter((o) => codeOf(o) === c);
  if (exact.length > 0) return exact;
  try {
    const result: any = await lookupBarcode(c);
    const ids: string[] = result?.matches
      ? result.matches.map((m: any) => String(m.stock_id))
      : result?.stock_id != null ? [String(result.stock_id)] : [];
    return options.filter((o) => ids.includes(codeOf(o)));
  } catch {
    return [];
  }
}
