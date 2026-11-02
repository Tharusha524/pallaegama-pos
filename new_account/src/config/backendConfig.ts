import { DEFAULT_API_BASE_URL } from "./appConfig";

export const BACKEND_CONFIG_STORAGE_KEY = "grow_ledger_api_base_url";

/**
 * Normalize user input to Laravel API base (…/index.php/api).
 * Accepts backend public URL, index.php URL, or full …/api URL.
 */
export function normalizeApiBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) return "";

  url = url.replace(/\/+$/, "");

  if (url.endsWith("/api")) {
    return url;
  }

  if (url.endsWith("/index.php")) {
    return `${url}/api`;
  }

  if (url.includes("/public")) {
    return `${url}/index.php/api`;
  }

  if (/^https?:\/\//i.test(url)) {
    return `${url}/api`;
  }

  return url;
}

export function getStoredApiBaseUrl(): string | null {
  try {
    const raw = localStorage.getItem(BACKEND_CONFIG_STORAGE_KEY);
    return raw ? normalizeApiBaseUrl(raw) : null;
  } catch {
    return null;
  }
}

/** Resolved API base: saved config → build-time env → default */
export function getApiBaseUrl(): string {
  const stored = getStoredApiBaseUrl();
  if (stored) return stored;

  const fromEnv = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (fromEnv) return normalizeApiBaseUrl(fromEnv);

  return DEFAULT_API_BASE_URL;
}

export function setStoredApiBaseUrl(input: string): string {
  const normalized = normalizeApiBaseUrl(input);
  if (!normalized) {
    throw new Error("Backend URL is required.");
  }
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("URL must start with http:// or https://");
  }
  localStorage.setItem(BACKEND_CONFIG_STORAGE_KEY, normalized);
  return normalized;
}

export function clearStoredApiBaseUrl(): void {
  localStorage.removeItem(BACKEND_CONFIG_STORAGE_KEY);
}

export async function testApiConnection(baseUrl?: string): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  const base = normalizeApiBaseUrl(baseUrl ?? getApiBaseUrl());
  const url = `${base}/login-slideshow-images`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (res.ok) {
      return { ok: true, status: res.status, message: "Connected successfully." };
    }

    const text = await res.text();
    let detail = text.slice(0, 120);
    try {
      const json = JSON.parse(text);
      detail = json.message ?? detail;
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      status: res.status,
      message: `Server responded with ${res.status}: ${detail}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      message: `Cannot reach API. Check URL and CORS. (${msg})`,
    };
  }
}
