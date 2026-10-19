import { getCompanies } from "../api/CompanySetup/CompanySetupApi";
import { resolveLogoSrc } from "../utils/logoUrl";
import { isDesktopApp, saveReferenceData, getReferenceData } from "./db";

/**
 * Company details + logo for the receipt, kept in the desktop app's offline
 * database so an offline receipt still shows them. Saved from the POS page
 * (never from the receipt itself, so printing is never slowed down).
 */
const COMPANY_KEY = "receipt_company";
const LOGO_KEY = "receipt_logo";

let savedThisSession = false;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Online: refresh the offline copy once per app session. Failures are ignored. */
export async function cacheReceiptBranding(): Promise<void> {
  if (!isDesktopApp() || savedThisSession) return;
  savedThisSession = true;
  try {
    const companies = await getCompanies();
    const company = companies?.[0];
    if (!company) return;
    await saveReferenceData(COMPANY_KEY, company);

    const logoUrl = resolveLogoSrc(company.company_logo_url);
    if (!logoUrl) {
      await saveReferenceData(LOGO_KEY, null);
      return;
    }
    if (logoUrl.startsWith("data:")) {
      await saveReferenceData(LOGO_KEY, logoUrl);
      return;
    }
    const token = localStorage.getItem("token");
    const res = await fetch(logoUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    await saveReferenceData(LOGO_KEY, await blobToDataUrl(await res.blob()));
  } catch {
    savedThisSession = false; // try again next time the POS page opens
  }
}

/** Offline: the last saved company details + logo (data URL), if any. */
export async function loadReceiptBranding(): Promise<{ company: any; logo: string | null } | null> {
  if (!isDesktopApp()) return null;
  try {
    const company = await getReferenceData<any>(COMPANY_KEY);
    if (!company) return null;
    const logo = await getReferenceData<string>(LOGO_KEY);
    return { company, logo: logo ?? null };
  } catch {
    return null;
  }
}
