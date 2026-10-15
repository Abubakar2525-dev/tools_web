/**
 * JSON-LD builders for common schema.org types. Field specs drive the form;
 * `build` turns flat values into a schema.org object; `validate` reports the
 * properties Google's structured data documentation lists as required.
 */

export type SchemaType = "Organization" | "LocalBusiness" | "Article" | "Product" | "FAQPage" | "BreadcrumbList" | "Event" | "Person" | "WebSite";

export interface FieldSpec {
  key: string;
  label: string;
  kind: "text" | "url" | "textarea" | "date" | "datetime" | "number" | "select" | "lines";
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
}

export interface RowSpec {
  title: string;
  itemLabel: string;
  cols: { key: string; label: string; kind: "text" | "url" | "textarea" }[];
  min: number;
}

export interface SchemaSpec {
  type: SchemaType;
  label: string;
  note?: string;
  fields: FieldSpec[];
  rows?: RowSpec;
  build: (v: Values, rows: Row[]) => Record<string, unknown>;
}

export type Values = Record<string, string>;
export type Row = Record<string, string>;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const t = (s: string | undefined) => (s ?? "").trim();
const lines = (s: string | undefined) =>
  t(s)
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Removes empty strings, empty arrays and objects that only hold "@type". */
export function prune(v: unknown): Json | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v.trim() ? v.trim() : undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    const a = v.map(prune).filter((x): x is Json => x !== undefined);
    return a.length ? a : undefined;
  }
  if (typeof v === "object") {
    const o: { [k: string]: Json } = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const p = prune(val);
      if (p !== undefined) o[k] = p;
    }
    const keys = Object.keys(o).filter((k) => k !== "@type" && k !== "@context");
    return keys.length ? o : undefined;
  }
  return undefined;
}

const num = (s: string | undefined) => {
  const v = t(s);
  return v && Number.isFinite(Number(v)) ? Number(v) : v || undefined;
};

const address = (v: Values) => ({
  "@type": "PostalAddress",
  streetAddress: v.streetAddress,
  addressLocality: v.addressLocality,
  addressRegion: v.addressRegion,
  postalCode: v.postalCode,
  addressCountry: v.addressCountry,
});

const withOffset = (dt: string | undefined, offset: string | undefined) => {
  const d = t(dt);
  if (!d) return "";
  const o = t(offset);
  return /T\d{2}:\d{2}$/.test(d) ? `${d}:00${o}` : d;
};

const AVAILABILITY = ["InStock", "OutOfStock", "PreOrder", "BackOrder", "Discontinued", "LimitedAvailability", "OnlineOnly", "InStoreOnly", "SoldOut"];

export const SPECS: SchemaSpec[] = [
  {
    type: "Organization",
    label: "Organization",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "url", label: "Website URL", kind: "url", required: true, placeholder: "https://example.com" },
      { key: "logo", label: "Logo URL", kind: "url", hint: "At least 112×112 px, crawlable." },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "email", label: "Email", kind: "text" },
      { key: "telephone", label: "Phone", kind: "text", placeholder: "+1-555-0100" },
      { key: "sameAs", label: "Profile URLs (sameAs)", kind: "lines", hint: "One URL per line: social profiles, Wikipedia, etc." },
    ],
    build: (v) => ({
      "@type": "Organization",
      name: v.name,
      url: v.url,
      logo: v.logo,
      description: v.description,
      email: v.email,
      telephone: v.telephone,
      sameAs: lines(v.sameAs),
    }),
  },
  {
    type: "LocalBusiness",
    label: "Local business",
    fields: [
      {
        key: "subtype",
        label: "Business type",
        kind: "select",
        options: ["LocalBusiness", "Restaurant", "CafeOrCoffeeShop", "Store", "Dentist", "MedicalClinic", "ProfessionalService", "HairSalon", "AutoRepair", "Hotel", "LegalService", "RealEstateAgent"].map((x) => ({ value: x, label: x })),
      },
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "url", label: "Website URL", kind: "url" },
      { key: "image", label: "Image URL", kind: "url" },
      { key: "telephone", label: "Phone", kind: "text" },
      { key: "priceRange", label: "Price range", kind: "text", placeholder: "$$" },
      { key: "streetAddress", label: "Street address", kind: "text", required: true },
      { key: "addressLocality", label: "City", kind: "text", required: true },
      { key: "addressRegion", label: "Region or state", kind: "text" },
      { key: "postalCode", label: "Postal code", kind: "text" },
      { key: "addressCountry", label: "Country code", kind: "text", placeholder: "US" },
      { key: "latitude", label: "Latitude", kind: "number" },
      { key: "longitude", label: "Longitude", kind: "number" },
      { key: "openingHours", label: "Opening hours", kind: "lines", hint: "One per line, e.g. Mo-Fr 09:00-17:00 or Sa 10:00-14:00." },
      { key: "sameAs", label: "Profile URLs (sameAs)", kind: "lines" },
    ],
    build: (v) => ({
      "@type": t(v.subtype) || "LocalBusiness",
      name: v.name,
      url: v.url,
      image: v.image,
      telephone: v.telephone,
      priceRange: v.priceRange,
      address: address(v),
      geo: t(v.latitude) && t(v.longitude) ? { "@type": "GeoCoordinates", latitude: num(v.latitude), longitude: num(v.longitude) } : undefined,
      openingHours: lines(v.openingHours),
      sameAs: lines(v.sameAs),
    }),
  },
  {
    type: "Article",
    label: "Article",
    fields: [
      { key: "subtype", label: "Article type", kind: "select", options: ["Article", "NewsArticle", "BlogPosting"].map((x) => ({ value: x, label: x })) },
      { key: "headline", label: "Headline", kind: "text", required: true, hint: "Keep it concise; long headlines may be truncated." },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "image", label: "Image URLs", kind: "lines", hint: "One per line. Google recommends several aspect ratios." },
      { key: "authorName", label: "Author name", kind: "text", required: true },
      { key: "authorType", label: "Author type", kind: "select", options: [{ value: "Person", label: "Person" }, { value: "Organization", label: "Organization" }] },
      { key: "authorUrl", label: "Author profile URL", kind: "url" },
      { key: "publisherName", label: "Publisher name", kind: "text" },
      { key: "publisherLogo", label: "Publisher logo URL", kind: "url" },
      { key: "datePublished", label: "Date published", kind: "date", required: true },
      { key: "dateModified", label: "Date modified", kind: "date" },
      { key: "url", label: "Article URL", kind: "url" },
    ],
    build: (v) => ({
      "@type": t(v.subtype) || "Article",
      headline: v.headline,
      description: v.description,
      image: lines(v.image),
      author: { "@type": t(v.authorType) || "Person", name: v.authorName, url: v.authorUrl },
      publisher: { "@type": "Organization", name: v.publisherName, logo: t(v.publisherLogo) ? { "@type": "ImageObject", url: v.publisherLogo } : undefined },
      datePublished: v.datePublished,
      dateModified: v.dateModified,
      mainEntityOfPage: t(v.url) ? { "@type": "WebPage", "@id": v.url } : undefined,
    }),
  },
  {
    type: "Product",
    label: "Product",
    note: "Product rich results need at least one of: offers (price), a review or an aggregate rating.",
    fields: [
      { key: "name", label: "Product name", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "image", label: "Image URLs", kind: "lines" },
      { key: "brand", label: "Brand", kind: "text" },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "gtin", label: "GTIN (barcode)", kind: "text" },
      { key: "price", label: "Price", kind: "number", placeholder: "29.99" },
      { key: "priceCurrency", label: "Currency (ISO 4217)", kind: "text", placeholder: "USD" },
      { key: "availability", label: "Availability", kind: "select", options: AVAILABILITY.map((x) => ({ value: x, label: x })) },
      { key: "condition", label: "Condition", kind: "select", options: ["NewCondition", "UsedCondition", "RefurbishedCondition", "DamagedCondition"].map((x) => ({ value: x, label: x })) },
      { key: "url", label: "Product page URL", kind: "url" },
      { key: "ratingValue", label: "Average rating", kind: "number", placeholder: "4.6" },
      { key: "reviewCount", label: "Number of reviews", kind: "number" },
    ],
    build: (v) => ({
      "@type": "Product",
      name: v.name,
      description: v.description,
      image: lines(v.image),
      brand: t(v.brand) ? { "@type": "Brand", name: v.brand } : undefined,
      sku: v.sku,
      gtin: v.gtin,
      offers: t(v.price)
        ? {
            "@type": "Offer",
            price: num(v.price),
            priceCurrency: t(v.priceCurrency).toUpperCase(),
            availability: t(v.availability) ? `https://schema.org/${v.availability}` : undefined,
            itemCondition: t(v.condition) ? `https://schema.org/${v.condition}` : undefined,
            url: v.url,
          }
        : undefined,
      aggregateRating: t(v.ratingValue) && t(v.reviewCount) ? { "@type": "AggregateRating", ratingValue: num(v.ratingValue), reviewCount: num(v.reviewCount) } : undefined,
    }),
  },
  {
    type: "FAQPage",
    label: "FAQ page",
    note: "Since 2023 Google shows FAQ rich results only for well-known government and health sites. The markup is still valid and readable by other consumers.",
    fields: [],
    rows: { title: "Questions", itemLabel: "Question", cols: [{ key: "q", label: "Question", kind: "text" }, { key: "a", label: "Answer", kind: "textarea" }], min: 1 },
    build: (_v, rows) => ({
      "@type": "FAQPage",
      mainEntity: rows
        .filter((r) => t(r.q) && t(r.a))
        .map((r) => ({ "@type": "Question", name: t(r.q), acceptedAnswer: { "@type": "Answer", text: t(r.a) } })),
    }),
  },
  {
    type: "BreadcrumbList",
    label: "Breadcrumbs",
    fields: [],
    rows: { title: "Trail", itemLabel: "Level", cols: [{ key: "name", label: "Name", kind: "text" }, { key: "url", label: "URL", kind: "url" }], min: 1 },
    build: (_v, rows) => {
      const items = rows.filter((r) => t(r.name));
      return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: t(r.name), item: i === items.length - 1 && !t(r.url) ? undefined : t(r.url) })),
      };
    },
  },
  {
    type: "Event",
    label: "Event",
    fields: [
      { key: "name", label: "Event name", kind: "text", required: true },
      { key: "startDate", label: "Start", kind: "datetime", required: true },
      { key: "endDate", label: "End", kind: "datetime" },
      { key: "offset", label: "UTC offset", kind: "text", placeholder: "+01:00", hint: "Appended to the times, e.g. -05:00. Leave empty for local time without offset." },
      { key: "status", label: "Status", kind: "select", options: ["EventScheduled", "EventCancelled", "EventPostponed", "EventRescheduled", "EventMovedOnline"].map((x) => ({ value: x, label: x })) },
      { key: "mode", label: "Attendance", kind: "select", options: [{ value: "OfflineEventAttendanceMode", label: "In person" }, { value: "OnlineEventAttendanceMode", label: "Online" }, { value: "MixedEventAttendanceMode", label: "Mixed" }] },
      { key: "locationName", label: "Venue name", kind: "text" },
      { key: "streetAddress", label: "Street address", kind: "text" },
      { key: "addressLocality", label: "City", kind: "text" },
      { key: "addressCountry", label: "Country code", kind: "text" },
      { key: "onlineUrl", label: "Online event URL", kind: "url" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "image", label: "Image URL", kind: "url" },
      { key: "organizerName", label: "Organizer", kind: "text" },
      { key: "organizerUrl", label: "Organizer URL", kind: "url" },
      { key: "price", label: "Ticket price", kind: "number" },
      { key: "priceCurrency", label: "Currency", kind: "text", placeholder: "EUR" },
      { key: "offerUrl", label: "Ticket URL", kind: "url" },
    ],
    build: (v) => {
      const mode = t(v.mode) || "OfflineEventAttendanceMode";
      const place = { "@type": "Place", name: v.locationName, address: address(v) };
      const virtual = { "@type": "VirtualLocation", url: v.onlineUrl };
      return {
        "@type": "Event",
        name: v.name,
        startDate: withOffset(v.startDate, v.offset),
        endDate: withOffset(v.endDate, v.offset),
        eventStatus: `https://schema.org/${t(v.status) || "EventScheduled"}`,
        eventAttendanceMode: `https://schema.org/${mode}`,
        location: mode === "OnlineEventAttendanceMode" ? virtual : mode === "MixedEventAttendanceMode" ? [place, virtual] : place,
        description: v.description,
        image: v.image,
        organizer: { "@type": "Organization", name: v.organizerName, url: v.organizerUrl },
        offers: t(v.price) ? { "@type": "Offer", price: num(v.price), priceCurrency: t(v.priceCurrency).toUpperCase(), url: v.offerUrl } : undefined,
      };
    },
  },
  {
    type: "Person",
    label: "Person",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "url", label: "Website URL", kind: "url" },
      { key: "image", label: "Photo URL", kind: "url" },
      { key: "jobTitle", label: "Job title", kind: "text" },
      { key: "worksFor", label: "Works for (organization)", kind: "text" },
      { key: "email", label: "Email", kind: "text" },
      { key: "sameAs", label: "Profile URLs (sameAs)", kind: "lines" },
    ],
    build: (v) => ({
      "@type": "Person",
      name: v.name,
      url: v.url,
      image: v.image,
      jobTitle: v.jobTitle,
      worksFor: t(v.worksFor) ? { "@type": "Organization", name: v.worksFor } : undefined,
      email: v.email,
      sameAs: lines(v.sameAs),
    }),
  },
  {
    type: "WebSite",
    label: "Website",
    note: "Google no longer shows the sitelinks search box, but WebSite markup still helps with the site name shown in results.",
    fields: [
      { key: "name", label: "Site name", kind: "text", required: true },
      { key: "alternateName", label: "Alternate name", kind: "text" },
      { key: "url", label: "Home page URL", kind: "url", required: true },
      { key: "search", label: "Search URL template", kind: "url", placeholder: "https://example.com/search?q={search_term_string}", hint: "Must contain {search_term_string}." },
    ],
    build: (v) => ({
      "@type": "WebSite",
      name: v.name,
      alternateName: v.alternateName,
      url: v.url,
      potentialAction: t(v.search)
        ? { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: v.search }, "query-input": "required name=search_term_string" }
        : undefined,
    }),
  },
];

export const specFor = (type: SchemaType) => SPECS.find((s) => s.type === type) as SchemaSpec;

const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export function validate(spec: SchemaSpec, v: Values, rows: Row[]): { field?: string; message: string }[] {
  const out: { field?: string; message: string }[] = [];
  for (const f of spec.fields) {
    const val = t(v[f.key]);
    if (f.required && !val) out.push({ field: f.key, message: `${f.label} is required.` });
    if (val && f.kind === "url" && !isUrl(val.replace("{search_term_string}", "x"))) out.push({ field: f.key, message: `${f.label} must be a full http(s) URL.` });
    if (val && f.kind === "lines" && /url|image|sameAs/i.test(f.key)) {
      const bad = lines(val).filter((l) => !isUrl(l));
      if (bad.length) out.push({ field: f.key, message: `Not a valid URL: ${bad[0]}` });
    }
    if (val && f.kind === "number" && !Number.isFinite(Number(val))) out.push({ field: f.key, message: `${f.label} must be a number.` });
  }
  if (spec.type === "WebSite" && t(v.search) && !v.search.includes("{search_term_string}"))
    out.push({ field: "search", message: "The search template must contain {search_term_string}." });
  if (spec.type === "Product" && t(v.price) && !/^[A-Z]{3}$/i.test(t(v.priceCurrency))) out.push({ field: "priceCurrency", message: "Add a three-letter currency code such as USD." });
  if (spec.type === "Event" && t(v.endDate) && t(v.startDate) && v.endDate < v.startDate) out.push({ field: "endDate", message: "End is before start." });
  if (spec.type === "Event" && t(v.offset) && !/^[+-](0\d|1[0-4]):[0-5]\d$/.test(t(v.offset))) out.push({ field: "offset", message: "Use the form +01:00 or -05:30." });
  if (spec.rows) {
    const filled = rows.filter((r) => spec.rows!.cols.every((c) => c.kind === "url" || t(r[c.key])));
    if (filled.length < spec.rows.min) out.push({ message: `Add at least ${spec.rows.min} complete ${spec.rows.itemLabel.toLowerCase()}.` });
    if (spec.type === "BreadcrumbList") {
      rows.forEach((r, i) => {
        if (t(r.name) && i < rows.length - 1 && !t(r.url)) out.push({ message: `Breadcrumb ${i + 1} needs a URL (only the last item may omit it).` });
        if (t(r.url) && !isUrl(t(r.url))) out.push({ message: `Breadcrumb ${i + 1} URL is not a valid http(s) URL.` });
      });
    }
  }
  return out;
}

export function toJsonLd(spec: SchemaSpec, v: Values, rows: Row[]): string {
  const obj = prune({ "@context": "https://schema.org", ...spec.build(v, rows) }) ?? { "@context": "https://schema.org", "@type": spec.type };
  // Escape "<" so the JSON cannot close the surrounding <script> element.
  const json = JSON.stringify(obj, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
