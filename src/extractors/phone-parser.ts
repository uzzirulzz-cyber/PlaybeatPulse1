// PhoneParserImpl — phone normalization + WhatsApp detection
import type { PhoneParser, ParsedPhone, WhatsAppEvidence } from "./index";
import { normalizePhone, detectWhatsApp } from "../lib/phone";

export class PhoneParserImpl implements PhoneParser {
  parse(input: string, defaultCountry?: string): ParsedPhone {
    const r = normalizePhone(input, defaultCountry);
    return {
      e164: r.e164,
      countryCode: r.countryCode,
      nationalNumber: r.nationalNumber,
      input: r.input,
      valid: r.valid,
      country: r.country,
    };
  }

  detectWhatsApp(html: string, defaultCountry?: string): WhatsAppEvidence[] {
    return detectWhatsApp(html, defaultCountry).map(w => ({
      phone: w.phone,
      raw: w.raw,
      e164: w.e164,
      confidence: w.confidence,
      source: w.source,
    }));
  }
}
