// Letters that sound alike at the till but are spelled differently in item names.
const LETTERS: Record<string, string> = {
  "ං": "න", "ණ": "න", "ළ": "ල", "ඩ": "ද", "ඪ": "ද", "ධ": "ද", "ඨ": "ට", "ථ": "ත",
  "ඛ": "ක", "ඝ": "ග", "ඵ": "ප", "භ": "බ", "ඡ": "ච", "ඣ": "ජ", "ශ": "ස", "ෂ": "ස",
  "ඬ": "නද", "ඳ": "නද", "ඟ": "නග", "ඹ": "මබ",
  "ආ": "අ", "ඇ": "අ", "ඈ": "අ", "ඊ": "ඉ", "ඌ": "උ", "ඒ": "එ", "ඕ": "ඔ",
  "ී": "ි", "ූ": "ු", "ේ": "ෙ", "ෝ": "ො", "ෛ": "යි", "ඓ": "අයි",
};
// Hal kirima, zero-width joiners and the a/ae vowel signs.
const IGNORED = /[්‌‍ාැෑ]/g;

/** Simple form of Sinhala text, so spelling differences don't stop a match. */
export function foldSinhala(text: string): string {
  return text
    .toLowerCase()
    .replace(IGNORED, "")
    .replace(/[ංණළඩඪධඨථඛඝඵභඡඣශෂඬඳඟඹආඇඈඊඌඒඕීූේෝෛඓ]/g, (c) => LETTERS[c])
    .replace(/([ක-ෆ])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** English spelling habits the Singlish converter has no letter for ("cream" -> "krim"). */
export function plainSinglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/c(?!h)/g, "k")
    .replace(/x/g, "ks")
    .replace(/ea/g, "i")
    .replace(/y/g, "i");
}

/** Every searched word must start a word of the (already folded) label. */
export function foldedWordsMatch(foldedSearch: string, foldedLabel: string): boolean {
  const words = foldedLabel.split(" ");
  return foldedSearch.split(" ").every((s) => words.some((w) => w.startsWith(s)));
}
