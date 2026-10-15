/** Field types for the mock data generator, backed by @faker-js/faker (type import only). */
import type { Faker } from "@faker-js/faker";

export type MockValue = string | number | boolean | null;

export interface FieldType {
  id: string;
  label: string;
  group: string;
  make: (f: Faker, row: number, ctx: { first: string; last: string }) => MockValue;
}

export const FIELD_TYPES: FieldType[] = [
  { id: "seq", label: "Row number (1, 2, 3…)", group: "IDs", make: (_f, row) => row + 1 },
  { id: "uuid", label: "UUID", group: "IDs", make: (f) => f.string.uuid() },
  { id: "firstName", label: "First name", group: "Person", make: (_f, _r, c) => c.first },
  { id: "lastName", label: "Last name", group: "Person", make: (_f, _r, c) => c.last },
  { id: "fullName", label: "Full name", group: "Person", make: (_f, _r, c) => `${c.first} ${c.last}` },
  { id: "email", label: "Email", group: "Person", make: (f, _r, c) => f.internet.email({ firstName: c.first, lastName: c.last, provider: "example.com" }) },
  { id: "username", label: "Username", group: "Person", make: (f, _r, c) => f.internet.username({ firstName: c.first, lastName: c.last }) },
  { id: "phone", label: "Phone number", group: "Person", make: (f) => f.phone.number() },
  { id: "birthdate", label: "Birth date", group: "Person", make: (f) => f.date.birthdate({ mode: "age", min: 18, max: 80 }).toISOString().slice(0, 10) },
  { id: "jobTitle", label: "Job title", group: "Person", make: (f) => f.person.jobTitle() },
  { id: "street", label: "Street address", group: "Location", make: (f) => f.location.streetAddress() },
  { id: "city", label: "City", group: "Location", make: (f) => f.location.city() },
  { id: "state", label: "State or region", group: "Location", make: (f) => f.location.state() },
  { id: "zip", label: "Postal code", group: "Location", make: (f) => f.location.zipCode() },
  { id: "country", label: "Country", group: "Location", make: (f) => f.location.country() },
  { id: "countryCode", label: "Country code", group: "Location", make: (f) => f.location.countryCode() },
  { id: "lat", label: "Latitude", group: "Location", make: (f) => f.location.latitude() },
  { id: "lng", label: "Longitude", group: "Location", make: (f) => f.location.longitude() },
  { id: "company", label: "Company name", group: "Business", make: (f) => f.company.name() },
  { id: "department", label: "Department", group: "Business", make: (f) => f.commerce.department() },
  { id: "product", label: "Product name", group: "Business", make: (f) => f.commerce.productName() },
  { id: "price", label: "Price", group: "Business", make: (f) => Number(f.commerce.price({ min: 1, max: 500 })) },
  { id: "currency", label: "Currency code", group: "Business", make: (f) => f.finance.currencyCode() },
  { id: "iban", label: "IBAN (fake)", group: "Business", make: (f) => f.finance.iban() },
  { id: "url", label: "URL", group: "Internet", make: (f) => f.internet.url() },
  { id: "domain", label: "Domain name", group: "Internet", make: (f) => f.internet.domainName() },
  { id: "ipv4", label: "IPv4 address", group: "Internet", make: (f) => f.internet.ipv4() },
  { id: "ipv6", label: "IPv6 address", group: "Internet", make: (f) => f.internet.ipv6() },
  { id: "userAgent", label: "User agent", group: "Internet", make: (f) => f.internet.userAgent() },
  { id: "color", label: "Hex color", group: "Internet", make: (f) => f.color.rgb() },
  { id: "int", label: "Integer 1 to 1000", group: "Data", make: (f) => f.number.int({ min: 1, max: 1000 }) },
  { id: "float", label: "Decimal 0 to 100", group: "Data", make: (f) => f.number.float({ min: 0, max: 100, fractionDigits: 2 }) },
  { id: "bool", label: "Boolean", group: "Data", make: (f) => f.datatype.boolean() },
  { id: "pastDate", label: "Date-time in the past year", group: "Data", make: (f) => f.date.past().toISOString() },
  { id: "futureDate", label: "Date-time in the next year", group: "Data", make: (f) => f.date.future().toISOString() },
  { id: "word", label: "Word", group: "Text", make: (f) => f.lorem.word() },
  { id: "sentence", label: "Sentence", group: "Text", make: (f) => f.lorem.sentence() },
  { id: "paragraph", label: "Paragraph", group: "Text", make: (f) => f.lorem.paragraph() },
  { id: "status", label: "Status (active, pending, closed)", group: "Text", make: (f) => f.helpers.arrayElement(["active", "pending", "closed"]) },
];

export const LOCALES: { value: string; label: string }[] = [
  { value: "en", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt_BR", label: "Portuguese (Brazil)" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ja", label: "Japanese" },
  { value: "zh_CN", label: "Chinese (Simplified)" },
];

export interface FieldSpec {
  id: string;
  name: string;
  type: string;
  /** Percent of rows that get null (0 = never). */
  nullPct: number;
}

export function generateRows(f: Faker, fields: FieldSpec[], count: number): Record<string, MockValue>[] {
  const rows: Record<string, MockValue>[] = [];
  const types = new Map(FIELD_TYPES.map((t) => [t.id, t]));
  for (let r = 0; r < count; r++) {
    const ctx = { first: f.person.firstName(), last: f.person.lastName() };
    const row: Record<string, MockValue> = {};
    for (const fs of fields) {
      const t = types.get(fs.type);
      if (!t || !fs.name.trim()) continue;
      row[fs.name.trim()] = fs.nullPct > 0 && f.number.int({ min: 1, max: 100 }) <= fs.nullPct ? null : t.make(f, r, ctx);
    }
    rows.push(row);
  }
  return rows;
}
