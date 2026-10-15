"use client";

import { FormulaTool, type FormulaSpec } from "@/components/tools/engines/FormulaTool";
import { digitCount, factorize, groupDigits, isPrime, nextPrime, prevPrime, parseBigInt, primesInRange } from "./lib/bigint";
import { BigDigits } from "./ui";

const MAX_CHECK_DIGITS = 100;
const MAX_RANGE = 1_000_000;
const MAX_HI = 1e12;

const spec: FormulaSpec = {
  modes: [
    { id: "check", label: "Check a number", fields: ["n"] },
    { id: "range", label: "Primes in a range", fields: ["lo", "hi"] },
    { id: "first", label: "First N primes", fields: ["count"] },
  ],
  fields: [
    { id: "n", label: "Number", type: "text", placeholder: "97 or 2305843009213693951", hint: `Whole number up to ${MAX_CHECK_DIGITS} digits.` },
    { id: "lo", label: "From", type: "number", integer: true, min: 0, max: MAX_HI, placeholder: "1" },
    { id: "hi", label: "To", type: "number", integer: true, min: 0, max: MAX_HI, placeholder: "100" },
    { id: "count", label: "How many primes", type: "number", integer: true, min: 1, max: 10000, placeholder: "50" },
  ],
  example: { n: "2305843009213693951", lo: "1", hi: "100", count: "25" },
  compute: (v) => {
    if (v.mode === "check") {
      const raw = v.str("n");
      const n = parseBigInt(raw);
      if (n === null) return "Enter a whole number (digits only).";
      if (digitCount(n) > MAX_CHECK_DIGITS) return `Numbers are limited to ${MAX_CHECK_DIGITS} digits.`;
      if (n < BigInt(2)) {
        return {
          outputs: [
            { label: "Result", value: "Not prime", primary: true, note: "Primes are whole numbers greater than 1 with exactly two divisors." },
            { label: "Next prime", value: "2" },
          ],
        };
      }
      const t = isPrime(n);
      const steps: string[] = [];
      let factorNote = "";
      if (!t.prime) {
        try {
          const f = factorize(n, Date.now() + 300);
          factorNote = `${groupDigits(f[0][0])} × ${groupDigits(n / f[0][0])}`;
          steps.push(`Smallest prime factor found: ${groupDigits(f[0][0])}`, `${groupDigits(n)} = ${factorNote}`);
        } catch {
          steps.push("Miller-Rabin found a witness, so the number is certainly composite (no small factor found quickly).");
        }
      } else {
        steps.push(
          t.certain
            ? "Trial division by primes up to 97, then Miller-Rabin with the 13 prime bases 2 to 41, which is proven correct for every n below 3.3 × 10²⁴."
            : "Trial division by primes up to 97, then Miller-Rabin with 25 prime bases. Above 3.3 × 10²⁴ this is a probabilistic test (error below 4⁻²⁵).",
        );
      }
      const next = nextPrime(n);
      const prev = prevPrime(n);
      const long = digitCount(n) > 15;
      return {
        outputs: [
          { label: "Result", value: t.prime ? (t.certain ? "Prime" : "Probable prime") : "Composite", primary: true, note: factorNote ? `Divisible: ${factorNote}` : undefined },
          { label: "Previous prime", value: prev === null ? "none" : long ? "See below" : groupDigits(prev) },
          { label: "Next prime", value: long ? "See below" : groupDigits(next) },
          { label: "Digits", value: String(digitCount(n)) },
        ],
        visual: long ? <BigDigits label="Previous and next prime" value={`Previous: ${prev ?? "none"}\nNext: ${next}`} /> : undefined,
        steps,
      };
    }
    let list: number[];
    let caption: string;
    if (v.mode === "range") {
      const lo = v.num("lo");
      const hi = v.num("hi");
      if (lo === null || hi === null) return null;
      if (hi < lo) return "“To” must be greater than or equal to “From”.";
      if (hi - lo > MAX_RANGE) return `The range can span at most ${MAX_RANGE.toLocaleString("en-US")} numbers.`;
      list = primesInRange(lo, hi);
      caption = `Primes from ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")}`;
    } else {
      const count = v.num("count");
      if (count === null) return null;
      // p_n < n(ln n + ln ln n) for n ≥ 6 (Rosser's theorem).
      const bound = count < 6 ? 15 : Math.ceil(count * (Math.log(count) + Math.log(Math.log(count))));
      list = primesInRange(2, bound).slice(0, count);
      caption = `First ${count.toLocaleString("en-US")} primes`;
    }
    const sum = list.reduce((s, p) => s + p, 0);
    return {
      outputs: [
        { label: "Primes found", value: list.length.toLocaleString("en-US"), primary: true },
        { label: "Smallest", value: list.length ? list[0].toLocaleString("en-US") : "none" },
        { label: "Largest", value: list.length ? list[list.length - 1].toLocaleString("en-US") : "none" },
        { label: "Sum", value: sum.toLocaleString("en-US") },
      ],
      visual: list.length ? <BigDigits label={caption} value={list.join(", ")} /> : undefined,
      steps: ["Segmented sieve of Eratosthenes: cross out multiples of every prime up to √(upper limit); what remains is prime."],
    };
  },
};

export default function Tool() {
  return <FormulaTool spec={spec} />;
}
