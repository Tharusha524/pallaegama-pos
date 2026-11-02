import { transliterate as singlishToSinhala } from "singlish-pro";
import { foldSinhala, foldedWordsMatch, plainSinglish } from "./sinhalaFold";
import { toSinhalaSearch } from "./singlishSearch";

/** Letters Sinhala writes differently for the same spoken sound. */
const ALT: Record<string, string[]> = {
  "ද": ["ඩ"], "ඩ": ["ද"],
  "ත": ["ට"], "ට": ["ත"],
  "න": ["ණ"], "ණ": ["න"],
  "ල": ["ළ"], "ළ": ["ල"],
  "ස": ["ශ", "ෂ"], "ශ": ["ස", "ෂ"], "ෂ": ["ස", "ශ"],
};

/** Short vowel sign <-> long vowel sign. "ා" maps to "" so a long "a" can be dropped. */
const SIGN_ALT: Record<string, string> = {
  "ා": "", "ැ": "ෑ", "ෑ": "ැ", "ි": "ී", "ී": "ි",
  "ු": "ූ", "ූ": "ු", "ෙ": "ේ", "ේ": "ෙ", "ො": "ෝ", "ෝ": "ො",
};

const MARKS = new Set([..."ාැෑිීුූෘෲෙේෛොෝෞ්ංඃ‍"]);
const isConsonant = (c: string) => c >= "ක" && c <= "ෆ";

type Site = { i: number; alts: string[]; cost: number };

/**
 * Places the spelling could differ, with how likely that difference is.
 * A trailing "ා" is cheap because most Sinhala nouns end in one.
 */
function sitesOf(base: string): Site[] {
  const out: Site[] = [];
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (MARKS.has(ch)) {
      if (ch in SIGN_ALT) out.push({ i, alts: [SIGN_ALT[ch]], cost: ch === "ා" ? 1.2 : 0.8 });
      continue;
    }
    const swaps = ALT[ch] ?? [];
    if (swaps.length) out.push({ i, alts: swaps, cost: 1 });
    const next = base[i + 1];
    if (isConsonant(ch) && (!next || !MARKS.has(next))) {
      const last = i === base.length - 1;
      out.push({ i, alts: [ch + "ා"], cost: last ? 0.4 : 0.8 });
    }
  }
  return out;
}

const MAX_SITES = 12;
const MAX_EDITS = 3;

/**
 * Names already in the system that sound like what was typed, so a new item
 * gets spelled the same way as the items already there.
 */
export function existingNameMatches(names: string[], text: string, limit = 8): string[] {
  const typed = text.trim();
  if (typed.length < 3) return [];
  const folded = foldSinhala(toSinhalaSearch(plainSinglish(typed)));
  if (!folded) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name) || !foldedWordsMatch(folded, foldSinhala(name))) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Sinhala spellings a typed Singlish word could mean, likeliest first.
 * "papadam" -> පපදම්, පාපදම්, පපඩම්, පාපඩම් ...
 */
export function singlishSuggestions(text: string, limit = 25): string[] {
  const typed = text.trim();
  if (!typed || !/^[A-Za-z][A-Za-z\s]*$/.test(typed)) return [];

  let base: string;
  try {
    base = singlishToSinhala(typed);
  } catch {
    return [];
  }
  if (!base || base === typed) return [];

  // A word the user ended with a vowel keeps that vowel; it never takes hal kirima.
  const endsInVowel = /[aeiou]$/i.test(typed);

  const sites = sitesOf(base).slice(0, MAX_SITES);
  const scored: { word: string; cost: number }[] = [{ word: base, cost: 0 }];

  const build = (from: number, word: string, shift: number, cost: number, edits: number) => {
    if (edits === MAX_EDITS) return;
    for (let s = from; s < sites.length; s++) {
      const site = sites[s];
      const at = site.i + shift;
      if (at >= word.length || word[at] !== base[site.i]) continue;
      site.alts.forEach((alt, rank) => {
        const next = word.slice(0, at) + alt + word.slice(at + 1);
        const nextCost = cost + site.cost + rank * 0.2;
        scored.push({ word: next, cost: nextCost });
        build(s + 1, next, shift + alt.length - 1, nextCost, edits + 1);
      });
    }
  };
  build(0, base, 0, 0, 0);

  scored.sort((a, b) => a.cost - b.cost);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const { word } of scored) {
    const final = !endsInVowel && isConsonant(word[word.length - 1]) ? word + "්" : word;
    if (!seen.has(final)) {
      seen.add(final);
      out.push(final);
      if (out.length >= limit) break;
    }
  }
  return out;
}
