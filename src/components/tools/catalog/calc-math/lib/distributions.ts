/**
 * Probability distributions with near double-precision accuracy.
 * - ln Γ: Lanczos (g = 7, 9 terms), ~15 significant digits.
 * - Regularized incomplete gamma P/Q: series + Lentz continued fraction.
 * - Regularized incomplete beta: Lentz continued fraction.
 * - Normal CDF from the incomplete gamma (erfc(x) = Q(1/2, x²)), so tails keep relative accuracy.
 * - Normal quantile: Acklam's rational approximation refined with one Halley step.
 * - Student t and chi-square quantiles: bracketing + bisection on the CDF.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-16;
const FPMIN = 1e-300;

/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaCF(a, x);
}

/** Regularized upper incomplete gamma Q(a, x) = 1 − P(a, x), computed directly in the tail. */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - gammaSeries(a, x);
  return gammaCF(a, x);
}

function gammaSeries(a: number, x: number): number {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 10000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

function gammaCF(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

function betaCF(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function betaI(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betaCF(a, b, x)) / a;
  return 1 - (bt * betaCF(b, a, 1 - x)) / b;
}

/* ---------------------------- Normal ---------------------------- */

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Standard normal CDF Φ(z). */
export function normalCdf(z: number): number {
  if (Number.isNaN(z)) return NaN;
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const h = 0.5 * gammaQ(0.5, (z * z) / 2); // = 0.5 · erfc(|z|/√2) = upper tail of |z|
  return z < 0 ? h : 1 - h;
}

/** Upper tail 1 − Φ(z), accurate for large z. */
export function normalSf(z: number): number {
  return normalCdf(-z);
}

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** Standard normal quantile Φ⁻¹(p). */
export function normalInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log1p(-p));
    x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  // Halley refinement against the accurate CDF (use the smaller tail for precision).
  for (let i = 0; i < 2; i++) {
    const e = x < 0 ? normalCdf(x) - p : 1 - p - normalSf(x);
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}

/* ---------------------------- Student t ---------------------------- */

/** P(T ≤ t) for Student t with df degrees of freedom (df may be non-integer, > 0). */
export function tCdf(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return NaN;
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const x = df / (df + t * t);
  const tail = 0.5 * betaI(df / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

/** Upper tail P(T > t), accurate for large t. */
export function tSf(t: number, df: number): number {
  return tCdf(-t, df);
}

function invertMonotone(cdf: (x: number) => number, p: number, lo: number, hi: number): number {
  // Expand bracket.
  let a = lo;
  let b = hi;
  for (let i = 0; i < 200 && cdf(a) > p; i++) a = a < 0 ? a * 2 : a - 1;
  for (let i = 0; i < 200 && cdf(b) < p; i++) b = b > 0 ? b * 2 : b + 1;
  for (let i = 0; i < 300; i++) {
    const m = (a + b) / 2;
    if (m === a || m === b) break;
    if (cdf(m) < p) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/** Student t quantile. */
export function tInv(p: number, df: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  if (p === 0.5) return 0;
  // Use symmetry and the upper tail for precision.
  if (p > 0.5) return -tInv(1 - p, df);
  const z = normalInv(p);
  return invertMonotone((x) => tCdf(x, df), p, Math.min(z * 2, -1), 0);
}

/* ---------------------------- Chi-square ---------------------------- */

export function chi2Cdf(x: number, df: number): number {
  if (x <= 0) return 0;
  return gammaP(df / 2, x / 2);
}

export function chi2Sf(x: number, df: number): number {
  if (x <= 0) return 1;
  return gammaQ(df / 2, x / 2);
}

export function chi2Inv(p: number, df: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? 0 : p === 1 ? Infinity : NaN;
  return invertMonotone((x) => chi2Cdf(x, df), p, 0, Math.max(1, df * 2));
}

/* ---------------------------- Binomial ---------------------------- */

export function lnChoose(n: number, k: number): number {
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
}

export function binomPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n || !Number.isInteger(k)) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lnChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}

/** P(X ≤ k) via the incomplete beta: I_{1−p}(n − k, k + 1). */
export function binomCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p === 0) return 1;
  if (p === 1) return 0;
  return betaI(n - k, k + 1, 1 - p);
}
