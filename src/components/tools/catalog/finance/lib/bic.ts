/**
 * SWIFT / BIC (ISO 9362) structure check.
 * Layout: 4-char party prefix (bank code) + 2-letter ISO 3166-1 country code
 * + 2-char location code + optional 3-char branch code.
 */

const ISO_3166 =
  "AD Andorra|AE United Arab Emirates|AF Afghanistan|AG Antigua and Barbuda|AI Anguilla|AL Albania|AM Armenia|AO Angola|AQ Antarctica|AR Argentina|AS American Samoa|AT Austria|AU Australia|AW Aruba|AX Aland Islands|AZ Azerbaijan|BA Bosnia and Herzegovina|BB Barbados|BD Bangladesh|BE Belgium|BF Burkina Faso|BG Bulgaria|BH Bahrain|BI Burundi|BJ Benin|BL Saint Barthelemy|BM Bermuda|BN Brunei Darussalam|BO Bolivia|BQ Bonaire, Sint Eustatius and Saba|BR Brazil|BS Bahamas|BT Bhutan|BV Bouvet Island|BW Botswana|BY Belarus|BZ Belize|CA Canada|CC Cocos (Keeling) Islands|CD Congo (Democratic Republic)|CF Central African Republic|CG Congo|CH Switzerland|CI Cote d'Ivoire|CK Cook Islands|CL Chile|CM Cameroon|CN China|CO Colombia|CR Costa Rica|CU Cuba|CV Cabo Verde|CW Curacao|CX Christmas Island|CY Cyprus|CZ Czechia|DE Germany|DJ Djibouti|DK Denmark|DM Dominica|DO Dominican Republic|DZ Algeria|EC Ecuador|EE Estonia|EG Egypt|EH Western Sahara|ER Eritrea|ES Spain|ET Ethiopia|FI Finland|FJ Fiji|FK Falkland Islands|FM Micronesia|FO Faroe Islands|FR France|GA Gabon|GB United Kingdom|GD Grenada|GE Georgia|GF French Guiana|GG Guernsey|GH Ghana|GI Gibraltar|GL Greenland|GM Gambia|GN Guinea|GP Guadeloupe|GQ Equatorial Guinea|GR Greece|GS South Georgia and the South Sandwich Islands|GT Guatemala|GU Guam|GW Guinea-Bissau|GY Guyana|HK Hong Kong|HM Heard Island and McDonald Islands|HN Honduras|HR Croatia|HT Haiti|HU Hungary|ID Indonesia|IE Ireland|IL Israel|IM Isle of Man|IN India|IO British Indian Ocean Territory|IQ Iraq|IR Iran|IS Iceland|IT Italy|JE Jersey|JM Jamaica|JO Jordan|JP Japan|KE Kenya|KG Kyrgyzstan|KH Cambodia|KI Kiribati|KM Comoros|KN Saint Kitts and Nevis|KP Korea (North)|KR Korea (South)|KW Kuwait|KY Cayman Islands|KZ Kazakhstan|LA Lao People's Democratic Republic|LB Lebanon|LC Saint Lucia|LI Liechtenstein|LK Sri Lanka|LR Liberia|LS Lesotho|LT Lithuania|LU Luxembourg|LV Latvia|LY Libya|MA Morocco|MC Monaco|MD Moldova|ME Montenegro|MF Saint Martin (French part)|MG Madagascar|MH Marshall Islands|MK North Macedonia|ML Mali|MM Myanmar|MN Mongolia|MO Macao|MP Northern Mariana Islands|MQ Martinique|MR Mauritania|MS Montserrat|MT Malta|MU Mauritius|MV Maldives|MW Malawi|MX Mexico|MY Malaysia|MZ Mozambique|NA Namibia|NC New Caledonia|NE Niger|NF Norfolk Island|NG Nigeria|NI Nicaragua|NL Netherlands|NO Norway|NP Nepal|NR Nauru|NU Niue|NZ New Zealand|OM Oman|PA Panama|PE Peru|PF French Polynesia|PG Papua New Guinea|PH Philippines|PK Pakistan|PL Poland|PM Saint Pierre and Miquelon|PN Pitcairn|PR Puerto Rico|PS Palestine|PT Portugal|PW Palau|PY Paraguay|QA Qatar|RE Reunion|RO Romania|RS Serbia|RU Russian Federation|RW Rwanda|SA Saudi Arabia|SB Solomon Islands|SC Seychelles|SD Sudan|SE Sweden|SG Singapore|SH Saint Helena, Ascension and Tristan da Cunha|SI Slovenia|SJ Svalbard and Jan Mayen|SK Slovakia|SL Sierra Leone|SM San Marino|SN Senegal|SO Somalia|SR Suriname|SS South Sudan|ST Sao Tome and Principe|SV El Salvador|SX Sint Maarten (Dutch part)|SY Syria|SZ Eswatini|TC Turks and Caicos Islands|TD Chad|TF French Southern Territories|TG Togo|TH Thailand|TJ Tajikistan|TK Tokelau|TL Timor-Leste|TM Turkmenistan|TN Tunisia|TO Tonga|TR Turkey|TT Trinidad and Tobago|TV Tuvalu|TW Taiwan|TZ Tanzania|UA Ukraine|UG Uganda|UM United States Minor Outlying Islands|US United States|UY Uruguay|UZ Uzbekistan|VA Holy See (Vatican City)|VC Saint Vincent and the Grenadines|VE Venezuela|VG Virgin Islands (British)|VI Virgin Islands (U.S.)|VN Viet Nam|VU Vanuatu|WF Wallis and Futuna|WS Samoa|YE Yemen|YT Mayotte|ZA South Africa|ZM Zambia|ZW Zimbabwe";

/** ISO 3166-1 alpha-2 officially assigned codes (249). */
export const COUNTRIES: Record<string, string> = Object.fromEntries(
  ISO_3166.split("|").map((p) => [p.slice(0, 2), p.slice(3)]),
);

/** Codes SWIFT uses that are not officially assigned in ISO 3166-1. */
const SWIFT_EXTRA: Record<string, string> = { XK: "Kosovo (user-assigned code used by SWIFT)" };

export type BicField = { part: string; label: string; value: string; ok: boolean; note: string };

export type BicResult = {
  bic: string;
  valid: boolean;
  /** Errors make the code invalid; warnings are unusual but legal patterns. */
  errors: string[];
  warnings: string[];
  fields: BicField[];
  primaryOffice: boolean;
  test: boolean;
  bic11: string | null;
};

export function normalizeBic(input: string): string {
  return input.toUpperCase().replace(/[\s\-.]/g, "");
}

export function checkBic(input: string): BicResult {
  const bic = normalizeBic(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/^[A-Z0-9]*$/.test(bic)) errors.push("Only letters A to Z and digits are allowed.");
  if (bic.length !== 8 && bic.length !== 11) errors.push(`A BIC has 8 or 11 characters; this has ${bic.length}.`);

  const bank = bic.slice(0, 4);
  const country = bic.slice(4, 6);
  const location = bic.slice(6, 8);
  const branch = bic.slice(8, 11);

  const bankOk = /^[A-Z0-9]{4}$/.test(bank);
  if (!bankOk) errors.push("The bank code (characters 1 to 4) must be 4 letters or digits.");
  else if (!/^[A-Z]{4}$/.test(bank)) warnings.push("Bank codes are letters in practice; ISO 9362:2014 allows digits, but they are rare.");

  const countryName = COUNTRIES[country] ?? SWIFT_EXTRA[country] ?? null;
  const countryOk = /^[A-Z]{2}$/.test(country) && countryName !== null;
  if (!countryOk) errors.push(`"${country}" (characters 5 and 6) is not an ISO 3166-1 country code.`);

  const locOk = /^[A-Z0-9]{2}$/.test(location);
  if (!locOk) errors.push("The location code (characters 7 and 8) must be 2 letters or digits.");
  const test = locOk && location[1] === "0";
  let locNote = "Identifies the city or region of the office.";
  if (locOk) {
    if (location[1] === "0") locNote = "Second character 0: a test and training BIC, not used for live payments.";
    else if (location[1] === "1") locNote = "Second character 1: a passive participant (not connected to SWIFT directly).";
    else if (location[1] === "2") locNote = "Second character 2: the receiver pays the message fees (reverse billing).";
    if (location[0] === "0" || location[0] === "1") warnings.push("A location code normally does not start with 0 or 1.");
    if (location[1] === "O") warnings.push("Letter O is not used as the second location character; check whether a zero was meant.");
  }

  let branchOk = true;
  let branchNote = "No branch code: the BIC refers to the primary office.";
  if (bic.length === 11) {
    branchOk = /^[A-Z0-9]{3}$/.test(branch);
    if (!branchOk) errors.push("The branch code (characters 9 to 11) must be 3 letters or digits.");
    else if (branch === "XXX") branchNote = "XXX means the primary office (same as the 8-character BIC).";
    else if (branch[0] === "X") {
      branchOk = false;
      errors.push("Branch codes starting with X are reserved; only XXX is allowed.");
      branchNote = "Reserved pattern.";
    } else branchNote = "Identifies a specific branch or department.";
  }

  const fields: BicField[] = [
    { part: "1-4", label: "Bank (party prefix)", value: bank, ok: bankOk, note: "Assigned to the institution by SWIFT." },
    { part: "5-6", label: "Country", value: country, ok: countryOk, note: countryName ?? "Unknown country code." },
    { part: "7-8", label: "Location", value: location, ok: locOk, note: locNote },
  ];
  if (bic.length === 11) fields.push({ part: "9-11", label: "Branch", value: branch, ok: branchOk, note: branchNote });

  const valid = errors.length === 0;
  return {
    bic,
    valid,
    errors,
    warnings,
    fields,
    primaryOffice: bic.length === 8 || branch === "XXX",
    test,
    bic11: valid ? (bic.length === 8 ? `${bic}XXX` : bic) : null,
  };
}
