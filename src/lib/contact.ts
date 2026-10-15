/** Shared contact-form contract, used by both the client form and the API route. */

export const budgetOptions = [
  "Not sure yet",
  "Under $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k – $100k",
  "$100k+",
] as const;

export type ContactPayload = {
  name: string;
  email: string;
  company: string;
  service: string;
  budget: string;
  details: string;
  /** Honeypot. Must stay empty. */
  website: string;
};

export type FieldErrors = Partial<Record<keyof ContactPayload, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(input: Partial<Record<keyof ContactPayload, unknown>>, serviceOptions: readonly string[]) {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const data: ContactPayload = {
    name: str(input.name, 120),
    email: str(input.email, 200),
    company: str(input.company, 160),
    service: str(input.service, 120),
    budget: str(input.budget, 40),
    details: str(input.details, 5000),
    website: str(input.website, 200),
  };

  const errors: FieldErrors = {};
  if (data.name.length < 2) errors.name = "Enter your name.";
  if (!data.email) errors.email = "Enter your work email.";
  else if (!EMAIL_RE.test(data.email)) errors.email = "Enter an email address like name@company.com.";
  if (!data.service || !serviceOptions.includes(data.service)) errors.service = "Choose the closest match, or “Not sure yet”.";
  if (data.budget && !(budgetOptions as readonly string[]).includes(data.budget)) errors.budget = "Choose a budget range.";
  if (data.details.length < 30)
    errors.details = "Add a little more detail (at least 30 characters): the problem, who it affects and any constraints.";

  return { data, errors, ok: Object.keys(errors).length === 0 };
}
