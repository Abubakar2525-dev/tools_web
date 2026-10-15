/**
 * US Consumer Price Index for All Urban Consumers (CPI-U), U.S. city average,
 * all items, not seasonally adjusted, 1982-84 = 100.
 *
 * Source: U.S. Bureau of Labor Statistics, via FRED (Federal Reserve Bank of
 * St. Louis) series CPIAUCNS, https://fred.stlouisfed.org/series/CPIAUCNS
 * Retrieved 2026-10-12. Annual values are the mean of the monthly index values
 * for each calendar year, rounded to 3 decimals.
 *
 * Note: BLS did not publish an October 2025 index (data collection was
 * suspended during the federal funding lapse), so the 2025 value averages the
 * 11 published months. 2026 is partial (January to August).
 */

export const CPI_SOURCE = "U.S. Bureau of Labor Statistics CPI-U (all items, U.S. city average, not seasonally adjusted), via FRED series CPIAUCNS";
export const CPI_RETRIEVED = "2026-10-12";
export const CPI_FIRST_YEAR = 1913;

/** Annual average index, index 0 = 1913, last = 2025. */
export const CPI_ANNUAL: readonly number[] = [
  9.883, 10.017, 10.108, 10.883, 12.825, 15.042, 17.333, 20.042, 17.85, 16.75,
  17.05, 17.125, 17.542, 17.7, 17.358, 17.158, 17.158, 16.7, 15.208, 13.642,
  12.933, 13.383, 13.725, 13.867, 14.383, 14.092, 13.908, 14.008, 14.725, 16.333,
  17.308, 17.592, 17.992, 19.517, 22.325, 24.042, 23.808, 24.067, 25.958, 26.55,
  26.767, 26.85, 26.775, 27.183, 28.092, 28.858, 29.15, 29.575, 29.892, 30.25,
  30.625, 31.017, 31.508, 32.458, 33.358, 34.783, 36.683, 38.825, 40.492, 41.817,
  44.4, 49.308, 53.817, 56.908, 60.608, 65.233, 72.575, 82.408, 90.925, 96.5,
  99.6, 103.883, 107.567, 109.608, 113.625, 118.258, 123.967, 130.658, 136.192, 140.317,
  144.458, 148.225, 152.383, 156.85, 160.517, 163.008, 166.575, 172.2, 177.067, 179.875,
  183.958, 188.883, 195.292, 201.592, 207.342, 215.303, 214.537, 218.056, 224.939, 229.594,
  232.957, 236.736, 237.017, 240.007, 245.12, 251.107, 255.657, 258.811, 270.97, 292.655,
  304.702, 313.689, 321.943
];

/** Latest partial year (not a full annual average). */
export const CPI_PARTIAL = { year: 2026, months: 8, throughMonth: "August", value: 331.655 } as const;

export const CPI_LAST_FULL_YEAR = CPI_FIRST_YEAR + CPI_ANNUAL.length - 1;

/** Index value for a year (full-year average, or the partial-year average for the latest year). */
export function cpiFor(year: number): number | null {
  if (year === CPI_PARTIAL.year) return CPI_PARTIAL.value;
  const i = year - CPI_FIRST_YEAR;
  return i >= 0 && i < CPI_ANNUAL.length ? CPI_ANNUAL[i] : null;
}

/** Converts an amount between years using the CPI ratio. */
export function adjustForInflation(amount: number, fromYear: number, toYear: number) {
  const a = cpiFor(fromYear);
  const b = cpiFor(toYear);
  if (a === null || b === null) return null;
  const ratio = b / a;
  const years = toYear - fromYear;
  return {
    value: amount * ratio,
    ratio,
    cumulativePct: (ratio - 1) * 100,
    avgAnnualPct: years !== 0 ? (Math.pow(ratio, 1 / years) - 1) * 100 : 0,
    fromIndex: a,
    toIndex: b,
  };
}
