// Free Email/Phone Validators — no API key required
// These improve lead quality by validating emails/phones without paid services.
import type { EmailValidationResult } from "./index";
import { safeFetch } from "../lib/ssrf";
import { normalizeEmail, validateEmail as localValidate } from "../lib/email";

// ---------------------------------------------------------------------------
// EVA (Pingutil) — Free email validation API (no auth, CORS enabled)
// Endpoint: https://eva.pingutil.com/api/v1/email/validate?email=...
// Returns: valid, disposable, spam, MX record status
// ---------------------------------------------------------------------------
export async function validateEmailEVA(email: string): Promise<EmailValidationResult | null> {
  try {
    const url = `https://eva.pingutil.com/api/v1/email/validate?email=${encodeURIComponent(email)}`;
    const res = await safeFetch(url, { timeoutMs: 5000, maxBytes: 64 * 1024 });
    if (res.status !== 200 || !res.html) return null;

    const data = JSON.parse(res.html);
    const d = data?.data;
    if (!d) return null;

    const syntaxValid = d.valid_syntax === true || d.syntax === "valid";
    const disposable = d.disposable === true || d.disposable_email === true;
    const domainValid = d.mx_records === true || d.has_mx === true;
    const quality = syntaxValid && !disposable && domainValid ? "high" : syntaxValid && !disposable ? "medium" : "low";
    const confidence = quality === "high" ? 85 : quality === "medium" ? 60 : 25;

    return {
      email: normalizeEmail(email) || email.toLowerCase(),
      syntaxValid,
      normalized: true,
      disposable,
      freeProvider: false,
      businessDomain: !disposable && syntaxValid,
      domainValid,
      quality: quality as "high" | "medium" | "low",
      confidence,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Kickbox — Free email verification (no auth)
// Endpoint: https://open.kickbox.com/v1/verify?email=...
// Returns: result (deliverable/undeliverable/risky/unknown), reason
// ---------------------------------------------------------------------------
export async function validateEmailKickbox(email: string): Promise<EmailValidationResult | null> {
  try {
    const url = `https://open.kickbox.com/v1/verify?email=${encodeURIComponent(email)}`;
    const res = await safeFetch(url, { timeoutMs: 5000, maxBytes: 64 * 1024 });
    if (res.status !== 200 || !res.html) return null;

    const data = JSON.parse(res.html);
    const result = data?.result;

    const valid = result === "deliverable";
    const risky = result === "risky";
    const disposable = data?.reason === "rejected_email" || data?.reason === "disposable_email";

    const quality = valid ? "high" : risky ? "medium" : "low";
    const confidence = valid ? 90 : risky ? 50 : 20;

    return {
      email: normalizeEmail(email) || email.toLowerCase(),
      syntaxValid: true,
      normalized: true,
      disposable,
      freeProvider: false,
      businessDomain: valid,
      domainValid: valid,
      quality: quality as "high" | "medium" | "low",
      confidence,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MailCheck.ai — Free disposable email detection (no auth)
// Endpoint: https://www.mailcheck.ai/api/domaincheck?domain=...
// ---------------------------------------------------------------------------
export async function checkDisposableMailCheck(domain: string): Promise<boolean | null> {
  try {
    const url = `https://www.mailcheck.ai/api/domaincheck?domain=${encodeURIComponent(domain)}`;
    const res = await safeFetch(url, { timeoutMs: 4000, maxBytes: 32 * 1024 });
    if (res.status !== 200 || !res.html) return null;

    const data = JSON.parse(res.html);
    return data?.disposable === true || data?.valid === false;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Combined email validator — tries free APIs, falls back to local validation
// ---------------------------------------------------------------------------
export async function validateEmailWithFreeAPIs(email: string): Promise<EmailValidationResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      email: email.toLowerCase(),
      syntaxValid: false,
      normalized: false,
      disposable: false,
      freeProvider: false,
      businessDomain: false,
      quality: "low",
      confidence: 0,
    };
  }

  // Try EVA first (most comprehensive free API)
  const evaResult = await validateEmailEVA(normalized);
  if (evaResult) return evaResult;

  // Try Kickbox
  const kickboxResult = await validateEmailKickbox(normalized);
  if (kickboxResult) return kickboxResult;

  // Fall back to local validation
  return localValidate(normalized);
}

// ---------------------------------------------------------------------------
// Phone validation — Numlookup (free tier, API key optional)
// ---------------------------------------------------------------------------
export async function validatePhoneNumlookup(phone: string, apiKey?: string): Promise<{ valid: boolean; carrier?: string; country?: string } | null> {
  try {
    const key = apiKey || process.env.NUMLOOKUP_API_KEY;
    const params = new URLSearchParams({ num: phone });
    if (key) params.set("apikey", key);
    const url = `https://api.numlookupapi.com/v1/validate?${params}`;
    const res = await safeFetch(url, { timeoutMs: 5000, maxBytes: 64 * 1024 });
    if (res.status !== 200 || !res.html) return null;

    const data = JSON.parse(res.html);
    return {
      valid: data?.valid === true,
      carrier: data?.carrier_name || undefined,
      country: data?.country_name || undefined,
    };
  } catch {
    return null;
  }
}
