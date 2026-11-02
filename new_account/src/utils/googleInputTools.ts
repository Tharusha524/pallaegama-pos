const ENDPOINT = "https://inputtools.google.com/request";

async function candidates(text: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({
    text,
    itc: "si-t-i0-und",
    num: "8",
    cp: "0",
    cs: "1",
    ie: "utf-8",
    oe: "utf-8",
    app: "pallegama-pos",
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) return [];
  const body = await res.json();
  if (body?.[0] !== "SUCCESS") return [];
  const list = body?.[1]?.[0]?.[1];
  return Array.isArray(list) ? list.filter((w: unknown): w is string => typeof w === "string") : [];
}

/**
 * Sinhala spellings from Google's own Singlish typing service.
 * Returns [] when offline or when Google cannot be reached.
 *
 * Google only returns one spelling for a phrase, so for several words the
 * last word is looked up on its own and joined to the rest.
 */
export async function googleSinhalaSuggestions(text: string, signal?: AbortSignal): Promise<string[]> {
  const typed = text.trim().replace(/\s+/g, " ");
  if (typed.length < 2 || !/^[A-Za-z][A-Za-z ]*$/.test(typed)) return [];

  const whole = await candidates(typed, signal);
  const words = typed.split(" ");
  if (words.length < 2) return whole;

  const head = whole[0]?.split(" ").slice(0, -1).join(" ") ?? "";
  if (!head) return whole;

  const tail = await candidates(words[words.length - 1], signal);
  const out = [...whole];
  const seen = new Set(out);
  for (const word of tail) {
    const full = `${head} ${word}`;
    if (!seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
  }
  return out;
}
