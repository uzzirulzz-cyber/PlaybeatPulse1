// EmailValidatorImpl — email validation pipeline
import type { EmailValidator, EmailValidationResult } from "./index";
import { normalizeEmail, validateEmail, isBusinessRoleEmail } from "../lib/email";

const PLACEHOLDER_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /@test\./i, /@demo\./i, /@fake\./i, /@dummy\./i,
  /^test@/, /^demo@/, /^fake@/, /^dummy@/,
  /john@doe\.com/i, /jane@doe\.com/i,
  /@yourdomain\./i, /@domain\.com$/i,
];

export class EmailValidatorImpl implements EmailValidator {
  validate(email: string, domainValid?: boolean): EmailValidationResult {
    const v = validateEmail(email, domainValid);
    return {
      email: v.email,
      syntaxValid: v.syntaxValid,
      normalized: v.normalized,
      disposable: v.disposable,
      freeProvider: v.freeProvider,
      businessDomain: v.businessDomain,
      domainValid: v.domainValid,
      quality: v.quality as "high" | "medium" | "low",
      confidence: v.confidence,
    };
  }

  normalize(email: string): string | null {
    return normalizeEmail(email);
  }

  isPlaceholder(email: string): boolean {
    const e = email.toLowerCase().trim();
    return PLACEHOLDER_PATTERNS.some(p => p.test(e));
  }
}
