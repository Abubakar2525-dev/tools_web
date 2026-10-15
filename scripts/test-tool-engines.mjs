import assert from "node:assert/strict";

import { createFileAcceptMatcher, fileMatchesAccept } from "../src/components/tools/engines/file-accept.ts";
import { sizeBytes, bitrateFrom, pcmBitrate } from "../src/components/tools/catalog/audio/lib/bitrate.ts";
import { parseClock, shiftMinutes, breakEven, marginFromMarkup } from "../src/components/tools/catalog/business/lib/calc.ts";
import { requiredFinal, requiredGpa } from "../src/components/tools/catalog/calc-eng/lib/grades.ts";
import { convertUnits, downloadSeconds, lengthUnits } from "../src/components/tools/catalog/converters/lib/units.ts";
import { formatClock, splitDuration } from "../src/components/tools/catalog/datetime-a/lib/duration.ts";
import { salePrice, stackedDiscount, tip, unitPrice } from "../src/components/tools/catalog/finance/lib/simple.ts";
import { looksLikePdf, pdfHeaderVersion, sniffImage } from "../src/components/tools/catalog/pdf-a/lib/bytes.ts";
import { cleanUrl } from "../src/components/tools/catalog/research-web/lib/url-clean.ts";
import { applyCase, splitName } from "../src/components/tools/catalog/security-files/lib/names.ts";
import { decodeEntities, stripTags } from "../src/components/tools/catalog/text/lib/clean.ts";

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

// Shared file intake, including AI-generated images whose browser MIME is blank/generic.
assert.equal(fileMatchesAccept({ name: "chatgpt-image.png", type: "" }, "image/*"), true);
assert.equal(fileMatchesAccept({ name: "full-hd.webp", type: "application/octet-stream" }, "image/webp"), true);
assert.equal(fileMatchesAccept({ name: "report.PDF", type: "" }, "application/pdf,.pdf"), true);
assert.equal(fileMatchesAccept({ name: "unsafe.exe", type: "application/octet-stream" }, "image/*"), false);
const imageMatcher = createFileAcceptMatcher("image/*,.heic");
assert.equal(imageMatcher({ name: "large-chatgpt-image.avif", type: "" }), true);
assert.equal(imageMatcher({ name: "photo.heic", type: "application/octet-stream" }), true);
assert.equal(imageMatcher({ name: "archive.zip", type: "application/zip" }), false);

// Audio, finance, business, grades, and conversion engines.
assert.equal(sizeBytes(320_000, 60), 2_400_000);
assert.equal(bitrateFrom(2_400_000, 60), 320_000);
assert.equal(pcmBitrate(48_000, 24, 2), 2_304_000);
assert.deepEqual(salePrice(100, 20), { sale: 80, savings: 20 });
close(stackedDiscount(100, [20, 10]).effectivePct, 28);
assert.equal(tip(100, 10, 2, false).perPerson, 55);
close(unitPrice(5, 2, "kg", "g", 100), 0.25);
assert.equal(parseClock("9:30 am"), 570);
assert.equal(shiftMinutes(540, 1020, 60), 420);
const breakEvenResult = breakEven(1000, 25, 10);
assert.equal(breakEvenResult.units, 67);
close(breakEvenResult.exactUnits, 1000 / 15);
close(breakEvenResult.revenue, 25_000 / 15);
close(marginFromMarkup(25), 20);
close(requiredFinal(80, 0.2, 85), 105);
close(requiredGpa(3, 60, 30, 3.5), 4.5);
close(convertUnits(lengthUnits, 1, "mi", "m"), 1609.344);
assert.equal(downloadSeconds(8_000_000, 1_000_000), 8);

// Date/time and text engines.
assert.deepEqual(splitDuration(90_061_007), { days: 1, hours: 1, minutes: 1, seconds: 1, ms: 7 });
assert.equal(formatClock(3_661_000), "1:01:01");
assert.equal(decodeEntities("A &amp; B"), "A & B");
assert.equal(stripTags("<p>Hello <b>world</b></p>").trim(), "Hello world");
assert.equal(applyCase("Quarterly Report 2026", "kebab"), "quarterly-report-2026");
assert.deepEqual(splitName("archive.tar.gz"), { stem: "archive.tar", ext: "gz" });

// Web cleanup and binary image/PDF helpers.
const cleaned = cleanUrl("https://example.com/page?utm_source=test&id=7", {
  affiliate: false,
  extra: [],
  stripHashTracking: true,
});
assert.equal(cleaned.output, "https://example.com/page?id=7");
const pdf = new TextEncoder().encode("%PDF-1.7\n");
assert.equal(looksLikePdf(pdf), true);
assert.equal(pdfHeaderVersion(pdf), "1.7");
assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");

console.log("Tool engine tests OK: file, audio, finance, business, grade, converter, date, text, web and PDF helpers.");
