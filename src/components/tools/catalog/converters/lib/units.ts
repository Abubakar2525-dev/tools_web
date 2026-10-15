/**
 * Unit tables for the converter batch. Linear units store the exact factor to
 * the base unit (value_in_base = value * factor). Factors are definitional
 * values from NIST SP 811 (2008, Appendix B) and the SI Brochure (9th ed.)
 * wherever a definition exists. Structurally compatible with ConvUnit.
 */

export type Unit = {
  id: string;
  label: string;
  symbol: string;
  toBase: number | ((v: number) => number);
  fromBase?: (b: number) => number;
  group?: string;
};

/* Exact building blocks */
export const INCH = 0.0254; // m
export const FOOT = 0.3048; // m
export const YARD = 0.9144; // m
export const MILE = 1609.344; // m
export const POUND = 0.45359237; // kg
export const GRAVITY = 9.80665; // m/s², standard acceleration of gravity
export const LBF = POUND * GRAVITY; // 4.4482216152605 N
export const US_GALLON = 3.785411784; // L (231 in³)
export const UK_GALLON = 4.54609; // L
export const BTU_IT = 1055.05585262; // J
export const CAL_TH = 4.184; // J
export const HP_MECH = 745.69987158227022; // W (550 ft·lbf/s)
export const HP_METRIC = 735.49875; // W (75 kgf·m/s)
export const PSI = 6894.757293168; // Pa
export const ATM = 101325; // Pa
export const LIGHT_YEAR = 9460730472580800; // m (Julian year × c)
export const AU = 149597870700; // m (IAU 2012)
export const EV = 1.602176634e-19; // J (exact since 2019 SI)
export const MACH_SEA_LEVEL = 340.294; // m/s, ISA at 15 °C

/** Length, base metre. */
export const lengthUnits: Unit[] = [
  { id: "nm", label: "Nanometer", symbol: "nm", toBase: 1e-9, group: "Metric" },
  { id: "um", label: "Micrometer", symbol: "µm", toBase: 1e-6, group: "Metric" },
  { id: "mm", label: "Millimeter", symbol: "mm", toBase: 0.001, group: "Metric" },
  { id: "cm", label: "Centimeter", symbol: "cm", toBase: 0.01, group: "Metric" },
  { id: "dm", label: "Decimeter", symbol: "dm", toBase: 0.1, group: "Metric" },
  { id: "m", label: "Meter", symbol: "m", toBase: 1, group: "Metric" },
  { id: "km", label: "Kilometer", symbol: "km", toBase: 1000, group: "Metric" },
  { id: "mil", label: "Mil (thou)", symbol: "mil", toBase: INCH / 1000, group: "Imperial / US" },
  { id: "in", label: "Inch", symbol: "in", toBase: INCH, group: "Imperial / US" },
  { id: "hand", label: "Hand", symbol: "hh", toBase: 4 * INCH, group: "Imperial / US" },
  { id: "ft", label: "Foot", symbol: "ft", toBase: FOOT, group: "Imperial / US" },
  { id: "yd", label: "Yard", symbol: "yd", toBase: YARD, group: "Imperial / US" },
  { id: "fathom", label: "Fathom", symbol: "ftm", toBase: 6 * FOOT, group: "Imperial / US" },
  { id: "chain", label: "Chain", symbol: "ch", toBase: 22 * YARD, group: "Imperial / US" },
  { id: "furlong", label: "Furlong", symbol: "fur", toBase: 220 * YARD, group: "Imperial / US" },
  { id: "mi", label: "Mile", symbol: "mi", toBase: MILE, group: "Imperial / US" },
  { id: "nmi", label: "Nautical mile", symbol: "nmi", toBase: 1852, group: "Nautical" },
  { id: "angstrom", label: "Ångström", symbol: "Å", toBase: 1e-10, group: "Science" },
  { id: "au", label: "Astronomical unit", symbol: "au", toBase: AU, group: "Science" },
  { id: "ly", label: "Light year", symbol: "ly", toBase: LIGHT_YEAR, group: "Science" },
  { id: "pc", label: "Parsec", symbol: "pc", toBase: (648000 / Math.PI) * AU, group: "Science" },
];

/** Mass, base kilogram. */
export const weightUnits: Unit[] = [
  { id: "ug", label: "Microgram", symbol: "µg", toBase: 1e-9, group: "Metric" },
  { id: "mg", label: "Milligram", symbol: "mg", toBase: 1e-6, group: "Metric" },
  { id: "g", label: "Gram", symbol: "g", toBase: 0.001, group: "Metric" },
  { id: "kg", label: "Kilogram", symbol: "kg", toBase: 1, group: "Metric" },
  { id: "t", label: "Metric ton (tonne)", symbol: "t", toBase: 1000, group: "Metric" },
  { id: "ct", label: "Carat", symbol: "ct", toBase: 0.0002, group: "Metric" },
  { id: "gr", label: "Grain", symbol: "gr", toBase: POUND / 7000, group: "Avoirdupois" },
  { id: "oz", label: "Ounce", symbol: "oz", toBase: POUND / 16, group: "Avoirdupois" },
  { id: "lb", label: "Pound", symbol: "lb", toBase: POUND, group: "Avoirdupois" },
  { id: "st", label: "Stone", symbol: "st", toBase: 14 * POUND, group: "Avoirdupois" },
  { id: "shortton", label: "Short ton (US)", symbol: "ton (US)", toBase: 2000 * POUND, group: "Avoirdupois" },
  { id: "longton", label: "Long ton (UK)", symbol: "ton (UK)", toBase: 2240 * POUND, group: "Avoirdupois" },
  { id: "dwt", label: "Pennyweight", symbol: "dwt", toBase: (24 * POUND) / 7000, group: "Troy" },
  { id: "ozt", label: "Troy ounce", symbol: "oz t", toBase: (480 * POUND) / 7000, group: "Troy" },
  { id: "lbt", label: "Troy pound", symbol: "lb t", toBase: (5760 * POUND) / 7000, group: "Troy" },
];

/** Temperature, base kelvin. Values below absolute zero return NaN. */
const guard = (k: number) => (k < -1e-9 ? NaN : Math.max(k, 0));
export const temperatureUnits: Unit[] = [
  { id: "c", label: "Celsius", symbol: "°C", toBase: (v) => guard(v + 273.15), fromBase: (k) => k - 273.15 },
  { id: "f", label: "Fahrenheit", symbol: "°F", toBase: (v) => guard(((v + 459.67) * 5) / 9), fromBase: (k) => (k * 9) / 5 - 459.67 },
  { id: "k", label: "Kelvin", symbol: "K", toBase: (v) => guard(v), fromBase: (k) => k },
  { id: "r", label: "Rankine", symbol: "°R", toBase: (v) => guard((v * 5) / 9), fromBase: (k) => (k * 9) / 5 },
];

/** UK gas marks: nominal °F (gas mark n ≥ 1 is 250 + 25n °F). */
export const gasMarks: { mark: string; f: number; c: number; description: string }[] = [
  { mark: "1/4", f: 225, description: "Very cool" },
  { mark: "1/2", f: 250, description: "Very cool" },
  { mark: "1", f: 275, description: "Cool" },
  { mark: "2", f: 300, description: "Cool" },
  { mark: "3", f: 325, description: "Moderately cool" },
  { mark: "4", f: 350, description: "Moderate" },
  { mark: "5", f: 375, description: "Moderately hot" },
  { mark: "6", f: 400, description: "Hot" },
  { mark: "7", f: 425, description: "Hot" },
  { mark: "8", f: 450, description: "Very hot" },
  { mark: "9", f: 475, description: "Very hot" },
  { mark: "10", f: 500, description: "Extremely hot" },
].map((g) => ({ ...g, c: ((g.f - 32) * 5) / 9 }));

/** Area, base square metre. */
export const areaUnits: Unit[] = [
  { id: "mm2", label: "Square millimeter", symbol: "mm²", toBase: 1e-6, group: "Metric" },
  { id: "cm2", label: "Square centimeter", symbol: "cm²", toBase: 1e-4, group: "Metric" },
  { id: "m2", label: "Square meter", symbol: "m²", toBase: 1, group: "Metric" },
  { id: "are", label: "Are", symbol: "a", toBase: 100, group: "Metric" },
  { id: "ha", label: "Hectare", symbol: "ha", toBase: 10000, group: "Metric" },
  { id: "km2", label: "Square kilometer", symbol: "km²", toBase: 1e6, group: "Metric" },
  { id: "in2", label: "Square inch", symbol: "in²", toBase: INCH * INCH, group: "Imperial / US" },
  { id: "ft2", label: "Square foot", symbol: "ft²", toBase: FOOT * FOOT, group: "Imperial / US" },
  { id: "yd2", label: "Square yard", symbol: "yd²", toBase: YARD * YARD, group: "Imperial / US" },
  { id: "acre", label: "Acre (international)", symbol: "ac", toBase: 4840 * YARD * YARD, group: "Imperial / US" },
  { id: "mi2", label: "Square mile", symbol: "mi²", toBase: MILE * MILE, group: "Imperial / US" },
];

/** Volume, base litre. */
export const volumeUnits: Unit[] = [
  { id: "ml", label: "Milliliter", symbol: "mL", toBase: 0.001, group: "Metric" },
  { id: "cl", label: "Centiliter", symbol: "cL", toBase: 0.01, group: "Metric" },
  { id: "l", label: "Liter", symbol: "L", toBase: 1, group: "Metric" },
  { id: "cm3", label: "Cubic centimeter", symbol: "cm³", toBase: 0.001, group: "Metric" },
  { id: "m3", label: "Cubic meter", symbol: "m³", toBase: 1000, group: "Metric" },
  { id: "us-tsp", label: "US teaspoon", symbol: "tsp", toBase: US_GALLON / 768, group: "US customary" },
  { id: "us-tbsp", label: "US tablespoon", symbol: "tbsp", toBase: US_GALLON / 256, group: "US customary" },
  { id: "us-floz", label: "US fluid ounce", symbol: "US fl oz", toBase: US_GALLON / 128, group: "US customary" },
  { id: "us-cup", label: "US cup", symbol: "cup", toBase: US_GALLON / 16, group: "US customary" },
  { id: "us-pt", label: "US pint", symbol: "US pt", toBase: US_GALLON / 8, group: "US customary" },
  { id: "us-qt", label: "US quart", symbol: "US qt", toBase: US_GALLON / 4, group: "US customary" },
  { id: "us-gal", label: "US gallon", symbol: "US gal", toBase: US_GALLON, group: "US customary" },
  { id: "uk-floz", label: "UK fluid ounce", symbol: "UK fl oz", toBase: UK_GALLON / 160, group: "UK imperial" },
  { id: "uk-pt", label: "UK pint", symbol: "UK pt", toBase: UK_GALLON / 8, group: "UK imperial" },
  { id: "uk-qt", label: "UK quart", symbol: "UK qt", toBase: UK_GALLON / 4, group: "UK imperial" },
  { id: "uk-gal", label: "UK gallon", symbol: "UK gal", toBase: UK_GALLON, group: "UK imperial" },
  { id: "in3", label: "Cubic inch", symbol: "in³", toBase: INCH ** 3 * 1000, group: "Cubic" },
  { id: "ft3", label: "Cubic foot", symbol: "ft³", toBase: FOOT ** 3 * 1000, group: "Cubic" },
  { id: "yd3", label: "Cubic yard", symbol: "yd³", toBase: YARD ** 3 * 1000, group: "Cubic" },
  { id: "bbl", label: "Oil barrel (42 US gal)", symbol: "bbl", toBase: 42 * US_GALLON, group: "Cubic" },
];

/** Speed, base metre per second. */
export const speedUnits: Unit[] = [
  { id: "mps", label: "Meter per second", symbol: "m/s", toBase: 1 },
  { id: "kmh", label: "Kilometer per hour", symbol: "km/h", toBase: 1000 / 3600 },
  { id: "mph", label: "Mile per hour", symbol: "mph", toBase: MILE / 3600 },
  { id: "kn", label: "Knot", symbol: "kn", toBase: 1852 / 3600 },
  { id: "fps", label: "Foot per second", symbol: "ft/s", toBase: FOOT },
  { id: "ips", label: "Inch per second", symbol: "in/s", toBase: INCH },
  { id: "kms", label: "Kilometer per second", symbol: "km/s", toBase: 1000 },
  { id: "mach", label: "Mach (sea level, 15 °C)", symbol: "Ma", toBase: MACH_SEA_LEVEL },
];

const YEAR_S = 365.2425 * 86400; // average Gregorian year
/** Time, base second. */
export const timeUnits: Unit[] = [
  { id: "ns", label: "Nanosecond", symbol: "ns", toBase: 1e-9 },
  { id: "us", label: "Microsecond", symbol: "µs", toBase: 1e-6 },
  { id: "ms", label: "Millisecond", symbol: "ms", toBase: 0.001 },
  { id: "s", label: "Second", symbol: "s", toBase: 1 },
  { id: "min", label: "Minute", symbol: "min", toBase: 60 },
  { id: "h", label: "Hour", symbol: "h", toBase: 3600 },
  { id: "d", label: "Day", symbol: "d", toBase: 86400 },
  { id: "wk", label: "Week", symbol: "wk", toBase: 604800 },
  { id: "fortnight", label: "Fortnight", symbol: "fn", toBase: 1209600 },
  { id: "mo", label: "Month (average)", symbol: "mo", toBase: YEAR_S / 12 },
  { id: "yr", label: "Year (average Gregorian)", symbol: "yr", toBase: YEAR_S },
  { id: "decade", label: "Decade", symbol: "dec", toBase: YEAR_S * 10 },
  { id: "century", label: "Century", symbol: "c", toBase: YEAR_S * 100 },
  { id: "millennium", label: "Millennium", symbol: "ka", toBase: YEAR_S * 1000 },
];

/** Pressure, base pascal. */
export const pressureUnits: Unit[] = [
  { id: "pa", label: "Pascal", symbol: "Pa", toBase: 1, group: "SI" },
  { id: "hpa", label: "Hectopascal", symbol: "hPa", toBase: 100, group: "SI" },
  { id: "kpa", label: "Kilopascal", symbol: "kPa", toBase: 1000, group: "SI" },
  { id: "mpa", label: "Megapascal", symbol: "MPa", toBase: 1e6, group: "SI" },
  { id: "bar", label: "Bar", symbol: "bar", toBase: 1e5, group: "Other" },
  { id: "mbar", label: "Millibar", symbol: "mbar", toBase: 100, group: "Other" },
  { id: "atm", label: "Standard atmosphere", symbol: "atm", toBase: ATM, group: "Other" },
  { id: "torr", label: "Torr", symbol: "Torr", toBase: ATM / 760, group: "Other" },
  { id: "mmhg", label: "Millimeter of mercury (conventional)", symbol: "mmHg", toBase: 133.322387415, group: "Other" },
  { id: "inhg", label: "Inch of mercury (conventional)", symbol: "inHg", toBase: 133.322387415 * 25.4, group: "Other" },
  { id: "kgfcm2", label: "Kilogram-force per cm²", symbol: "kgf/cm²", toBase: GRAVITY * 1e4, group: "Other" },
  { id: "psi", label: "Pound-force per square inch", symbol: "psi", toBase: PSI, group: "US" },
  { id: "ksi", label: "Kilopound per square inch", symbol: "ksi", toBase: PSI * 1000, group: "US" },
  { id: "psf", label: "Pound-force per square foot", symbol: "psf", toBase: PSI / 144, group: "US" },
];

/** Energy, base joule. */
export const energyUnits: Unit[] = [
  { id: "j", label: "Joule", symbol: "J", toBase: 1, group: "SI" },
  { id: "kj", label: "Kilojoule", symbol: "kJ", toBase: 1000, group: "SI" },
  { id: "mj", label: "Megajoule", symbol: "MJ", toBase: 1e6, group: "SI" },
  { id: "gj", label: "Gigajoule", symbol: "GJ", toBase: 1e9, group: "SI" },
  { id: "wh", label: "Watt-hour", symbol: "Wh", toBase: 3600, group: "Electrical" },
  { id: "kwh", label: "Kilowatt-hour", symbol: "kWh", toBase: 3.6e6, group: "Electrical" },
  { id: "mwh", label: "Megawatt-hour", symbol: "MWh", toBase: 3.6e9, group: "Electrical" },
  { id: "cal", label: "Calorie (thermochemical)", symbol: "cal", toBase: CAL_TH, group: "Heat" },
  { id: "kcal", label: "Kilocalorie (food Calorie)", symbol: "kcal", toBase: CAL_TH * 1000, group: "Heat" },
  { id: "cal-it", label: "Calorie (International Table)", symbol: "cal IT", toBase: 4.1868, group: "Heat" },
  { id: "btu", label: "British thermal unit (IT)", symbol: "BTU", toBase: BTU_IT, group: "Heat" },
  { id: "therm-us", label: "Therm (US)", symbol: "thm (US)", toBase: 1.054804e8, group: "Heat" },
  { id: "therm-ec", label: "Therm (EC)", symbol: "thm (EC)", toBase: 1.05506e8, group: "Heat" },
  { id: "ev", label: "Electronvolt", symbol: "eV", toBase: EV, group: "Other" },
  { id: "erg", label: "Erg", symbol: "erg", toBase: 1e-7, group: "Other" },
  { id: "ftlbf", label: "Foot-pound force", symbol: "ft·lbf", toBase: FOOT * LBF, group: "Other" },
];

/** Power, base watt. */
export const powerUnits: Unit[] = [
  { id: "mw-milli", label: "Milliwatt", symbol: "mW", toBase: 0.001, group: "SI" },
  { id: "w", label: "Watt", symbol: "W", toBase: 1, group: "SI" },
  { id: "kw", label: "Kilowatt", symbol: "kW", toBase: 1000, group: "SI" },
  { id: "mw", label: "Megawatt", symbol: "MW", toBase: 1e6, group: "SI" },
  { id: "gw", label: "Gigawatt", symbol: "GW", toBase: 1e9, group: "SI" },
  { id: "hp", label: "Horsepower (mechanical)", symbol: "hp", toBase: HP_MECH, group: "Horsepower" },
  { id: "ps", label: "Horsepower (metric, PS)", symbol: "PS", toBase: HP_METRIC, group: "Horsepower" },
  { id: "hpe", label: "Horsepower (electrical)", symbol: "hp(E)", toBase: 746, group: "Horsepower" },
  { id: "btuh", label: "BTU per hour", symbol: "BTU/h", toBase: BTU_IT / 3600, group: "Heat" },
  { id: "kcalh", label: "Kilocalorie per hour", symbol: "kcal/h", toBase: (CAL_TH * 1000) / 3600, group: "Heat" },
  { id: "tr", label: "Refrigeration ton", symbol: "TR", toBase: (12000 * BTU_IT) / 3600, group: "Heat" },
  { id: "ftlbfs", label: "Foot-pound force per second", symbol: "ft·lbf/s", toBase: FOOT * LBF, group: "Other" },
];

/** Frequency, base hertz. */
export const frequencyUnits: Unit[] = [
  { id: "mhz-milli", label: "Millihertz", symbol: "mHz", toBase: 0.001 },
  { id: "hz", label: "Hertz", symbol: "Hz", toBase: 1 },
  { id: "khz", label: "Kilohertz", symbol: "kHz", toBase: 1e3 },
  { id: "mhz", label: "Megahertz", symbol: "MHz", toBase: 1e6 },
  { id: "ghz", label: "Gigahertz", symbol: "GHz", toBase: 1e9 },
  { id: "thz", label: "Terahertz", symbol: "THz", toBase: 1e12 },
  { id: "rpm", label: "Revolutions per minute", symbol: "rpm", toBase: 1 / 60 },
  { id: "rads", label: "Radians per second", symbol: "rad/s", toBase: 1 / (2 * Math.PI) },
  { id: "degs", label: "Degrees per second", symbol: "°/s", toBase: 1 / 360 },
];

/** Force, base newton. */
export const forceUnits: Unit[] = [
  { id: "n", label: "Newton", symbol: "N", toBase: 1, group: "SI" },
  { id: "kn", label: "Kilonewton", symbol: "kN", toBase: 1000, group: "SI" },
  { id: "mn", label: "Meganewton", symbol: "MN", toBase: 1e6, group: "SI" },
  { id: "dyn", label: "Dyne", symbol: "dyn", toBase: 1e-5, group: "CGS" },
  { id: "kgf", label: "Kilogram-force", symbol: "kgf", toBase: GRAVITY, group: "Gravitational" },
  { id: "tf", label: "Tonne-force", symbol: "tf", toBase: 1000 * GRAVITY, group: "Gravitational" },
  { id: "ozf", label: "Ounce-force", symbol: "ozf", toBase: LBF / 16, group: "US / Imperial" },
  { id: "lbf", label: "Pound-force", symbol: "lbf", toBase: LBF, group: "US / Imperial" },
  { id: "kip", label: "Kip (1000 lbf)", symbol: "kip", toBase: 1000 * LBF, group: "US / Imperial" },
  { id: "pdl", label: "Poundal", symbol: "pdl", toBase: POUND * FOOT, group: "US / Imperial" },
];

/** Torque, base newton metre. */
export const torqueUnits: Unit[] = [
  { id: "nm", label: "Newton meter", symbol: "N·m", toBase: 1, group: "SI" },
  { id: "ncm", label: "Newton centimeter", symbol: "N·cm", toBase: 0.01, group: "SI" },
  { id: "knm", label: "Kilonewton meter", symbol: "kN·m", toBase: 1000, group: "SI" },
  { id: "kgfm", label: "Kilogram-force meter", symbol: "kgf·m", toBase: GRAVITY, group: "Gravitational" },
  { id: "kgfcm", label: "Kilogram-force centimeter", symbol: "kgf·cm", toBase: GRAVITY / 100, group: "Gravitational" },
  { id: "ftlbf", label: "Foot-pound force", symbol: "ft·lbf", toBase: FOOT * LBF, group: "US / Imperial" },
  { id: "inlbf", label: "Inch-pound force", symbol: "in·lbf", toBase: INCH * LBF, group: "US / Imperial" },
  { id: "inozf", label: "Inch-ounce force", symbol: "in·ozf", toBase: (INCH * LBF) / 16, group: "US / Imperial" },
  { id: "dyncm", label: "Dyne centimeter", symbol: "dyn·cm", toBase: 1e-7, group: "CGS" },
];

/** Density, base kilogram per cubic metre. */
export const densityUnits: Unit[] = [
  { id: "kgm3", label: "Kilogram per cubic meter", symbol: "kg/m³", toBase: 1, group: "Metric" },
  { id: "gcm3", label: "Gram per cubic centimeter", symbol: "g/cm³", toBase: 1000, group: "Metric" },
  { id: "gml", label: "Gram per milliliter", symbol: "g/mL", toBase: 1000, group: "Metric" },
  { id: "kgl", label: "Kilogram per liter", symbol: "kg/L", toBase: 1000, group: "Metric" },
  { id: "gl", label: "Gram per liter", symbol: "g/L", toBase: 1, group: "Metric" },
  { id: "mgl", label: "Milligram per liter", symbol: "mg/L", toBase: 0.001, group: "Metric" },
  { id: "lbft3", label: "Pound per cubic foot", symbol: "lb/ft³", toBase: POUND / FOOT ** 3, group: "US / Imperial" },
  { id: "lbin3", label: "Pound per cubic inch", symbol: "lb/in³", toBase: POUND / INCH ** 3, group: "US / Imperial" },
  { id: "ozin3", label: "Ounce per cubic inch", symbol: "oz/in³", toBase: POUND / 16 / INCH ** 3, group: "US / Imperial" },
  { id: "lbgal", label: "Pound per US gallon", symbol: "lb/gal (US)", toBase: POUND / (US_GALLON / 1000), group: "US / Imperial" },
  { id: "lbgaluk", label: "Pound per UK gallon", symbol: "lb/gal (UK)", toBase: POUND / (UK_GALLON / 1000), group: "US / Imperial" },
];

/** Angle, base radian. */
export const angleUnits: Unit[] = [
  { id: "deg", label: "Degree", symbol: "°", toBase: Math.PI / 180 },
  { id: "rad", label: "Radian", symbol: "rad", toBase: 1 },
  { id: "mrad", label: "Milliradian", symbol: "mrad", toBase: 0.001 },
  { id: "grad", label: "Gradian (gon)", symbol: "gon", toBase: Math.PI / 200 },
  { id: "turn", label: "Turn (revolution)", symbol: "tr", toBase: 2 * Math.PI },
  { id: "arcmin", label: "Minute of arc", symbol: "′", toBase: Math.PI / 10800 },
  { id: "arcsec", label: "Second of arc", symbol: "″", toBase: Math.PI / 648000 },
  { id: "mil", label: "Mil (NATO, 6400 per turn)", symbol: "mil", toBase: (2 * Math.PI) / 6400 },
];

/** Fuel economy, base litres per 100 km. Inverse units are non-linear. */
const L100_PER_MPG_US = (100 * US_GALLON) / (MILE / 1000); // 235.2145833...
const L100_PER_MPG_UK = (100 * UK_GALLON) / (MILE / 1000); // 282.4809363...
const inv = (k: number) => (v: number) => (v === 0 ? Infinity : k / v);
export const fuelUnits: Unit[] = [
  { id: "l100", label: "Liters per 100 km", symbol: "L/100 km", toBase: 1, group: "Consumption (lower is better)" },
  { id: "gal100us", label: "US gallons per 100 miles", symbol: "gal (US)/100 mi", toBase: US_GALLON / (MILE / 1000), group: "Consumption (lower is better)" },
  { id: "gal100uk", label: "UK gallons per 100 miles", symbol: "gal (UK)/100 mi", toBase: UK_GALLON / (MILE / 1000), group: "Consumption (lower is better)" },
  { id: "mpgus", label: "Miles per US gallon", symbol: "mpg (US)", toBase: inv(L100_PER_MPG_US), fromBase: inv(L100_PER_MPG_US), group: "Economy (higher is better)" },
  { id: "mpguk", label: "Miles per UK gallon", symbol: "mpg (UK)", toBase: inv(L100_PER_MPG_UK), fromBase: inv(L100_PER_MPG_UK), group: "Economy (higher is better)" },
  { id: "kml", label: "Kilometers per liter", symbol: "km/L", toBase: inv(100), fromBase: inv(100), group: "Economy (higher is better)" },
  { id: "mpl", label: "Miles per liter", symbol: "mi/L", toBase: inv((100 * 1000) / MILE), fromBase: inv((100 * 1000) / MILE), group: "Economy (higher is better)" },
];

/** Data storage, base bit. */
export const storageUnits: Unit[] = [
  { id: "bit", label: "Bit", symbol: "b", toBase: 1, group: "Bits" },
  { id: "kbit", label: "Kilobit", symbol: "kb", toBase: 1e3, group: "Bits" },
  { id: "mbit", label: "Megabit", symbol: "Mb", toBase: 1e6, group: "Bits" },
  { id: "gbit", label: "Gigabit", symbol: "Gb", toBase: 1e9, group: "Bits" },
  { id: "tbit", label: "Terabit", symbol: "Tb", toBase: 1e12, group: "Bits" },
  { id: "kibit", label: "Kibibit", symbol: "Kib", toBase: 1024, group: "Bits" },
  { id: "mibit", label: "Mebibit", symbol: "Mib", toBase: 1024 ** 2, group: "Bits" },
  { id: "gibit", label: "Gibibit", symbol: "Gib", toBase: 1024 ** 3, group: "Bits" },
  { id: "byte", label: "Byte", symbol: "B", toBase: 8, group: "Decimal bytes (SI)" },
  { id: "kb", label: "Kilobyte", symbol: "kB", toBase: 8e3, group: "Decimal bytes (SI)" },
  { id: "mb", label: "Megabyte", symbol: "MB", toBase: 8e6, group: "Decimal bytes (SI)" },
  { id: "gb", label: "Gigabyte", symbol: "GB", toBase: 8e9, group: "Decimal bytes (SI)" },
  { id: "tb", label: "Terabyte", symbol: "TB", toBase: 8e12, group: "Decimal bytes (SI)" },
  { id: "pb", label: "Petabyte", symbol: "PB", toBase: 8e15, group: "Decimal bytes (SI)" },
  { id: "eb", label: "Exabyte", symbol: "EB", toBase: 8e18, group: "Decimal bytes (SI)" },
  { id: "kib", label: "Kibibyte", symbol: "KiB", toBase: 8 * 1024, group: "Binary bytes (IEC)" },
  { id: "mib", label: "Mebibyte", symbol: "MiB", toBase: 8 * 1024 ** 2, group: "Binary bytes (IEC)" },
  { id: "gib", label: "Gibibyte", symbol: "GiB", toBase: 8 * 1024 ** 3, group: "Binary bytes (IEC)" },
  { id: "tib", label: "Tebibyte", symbol: "TiB", toBase: 8 * 1024 ** 4, group: "Binary bytes (IEC)" },
  { id: "pib", label: "Pebibyte", symbol: "PiB", toBase: 8 * 1024 ** 5, group: "Binary bytes (IEC)" },
  { id: "eib", label: "Exbibyte", symbol: "EiB", toBase: 8 * 1024 ** 6, group: "Binary bytes (IEC)" },
];

/** Data transfer rate, base bit per second. */
export const rateUnits: Unit[] = [
  { id: "bps", label: "Bit per second", symbol: "bit/s", toBase: 1, group: "Bits per second" },
  { id: "kbps", label: "Kilobit per second", symbol: "kbit/s", toBase: 1e3, group: "Bits per second" },
  { id: "mbps", label: "Megabit per second", symbol: "Mbit/s", toBase: 1e6, group: "Bits per second" },
  { id: "gbps", label: "Gigabit per second", symbol: "Gbit/s", toBase: 1e9, group: "Bits per second" },
  { id: "tbps", label: "Terabit per second", symbol: "Tbit/s", toBase: 1e12, group: "Bits per second" },
  { id: "Bps", label: "Byte per second", symbol: "B/s", toBase: 8, group: "Bytes per second" },
  { id: "kBps", label: "Kilobyte per second", symbol: "kB/s", toBase: 8e3, group: "Bytes per second" },
  { id: "MBps", label: "Megabyte per second", symbol: "MB/s", toBase: 8e6, group: "Bytes per second" },
  { id: "GBps", label: "Gigabyte per second", symbol: "GB/s", toBase: 8e9, group: "Bytes per second" },
  { id: "KiBps", label: "Kibibyte per second", symbol: "KiB/s", toBase: 8 * 1024, group: "Binary bytes per second" },
  { id: "MiBps", label: "Mebibyte per second", symbol: "MiB/s", toBase: 8 * 1024 ** 2, group: "Binary bytes per second" },
  { id: "GiBps", label: "Gibibyte per second", symbol: "GiB/s", toBase: 8 * 1024 ** 3, group: "Binary bytes per second" },
];

/** Kitchen volume units, base millilitre. */
export const cookingVolumeUnits: Unit[] = [
  { id: "ml", label: "Milliliter", symbol: "mL", toBase: 1, group: "Metric" },
  { id: "l", label: "Liter", symbol: "L", toBase: 1000, group: "Metric" },
  { id: "m-tsp", label: "Metric teaspoon", symbol: "tsp (5 mL)", toBase: 5, group: "Metric" },
  { id: "m-tbsp", label: "Metric tablespoon", symbol: "tbsp (15 mL)", toBase: 15, group: "Metric" },
  { id: "au-tbsp", label: "Australian tablespoon", symbol: "tbsp (20 mL)", toBase: 20, group: "Metric" },
  { id: "m-cup", label: "Metric cup", symbol: "cup (250 mL)", toBase: 250, group: "Metric" },
  { id: "us-tsp", label: "US teaspoon", symbol: "tsp", toBase: (US_GALLON * 1000) / 768, group: "US" },
  { id: "us-tbsp", label: "US tablespoon", symbol: "tbsp", toBase: (US_GALLON * 1000) / 256, group: "US" },
  { id: "us-floz", label: "US fluid ounce", symbol: "US fl oz", toBase: (US_GALLON * 1000) / 128, group: "US" },
  { id: "us-cup", label: "US cup", symbol: "cup", toBase: (US_GALLON * 1000) / 16, group: "US" },
  { id: "us-pt", label: "US pint", symbol: "US pt", toBase: (US_GALLON * 1000) / 8, group: "US" },
  { id: "us-qt", label: "US quart", symbol: "US qt", toBase: (US_GALLON * 1000) / 4, group: "US" },
  { id: "us-gal", label: "US gallon", symbol: "US gal", toBase: US_GALLON * 1000, group: "US" },
  { id: "uk-floz", label: "UK fluid ounce", symbol: "UK fl oz", toBase: (UK_GALLON * 1000) / 160, group: "UK" },
  { id: "uk-cup", label: "UK cup (half imperial pint)", symbol: "UK cup", toBase: (UK_GALLON * 1000) / 16, group: "UK" },
  { id: "uk-pt", label: "UK pint", symbol: "UK pt", toBase: (UK_GALLON * 1000) / 8, group: "UK" },
];

/**
 * Approximate grams per US cup (236.6 mL), our own rounded working values.
 * Real weights vary with how an ingredient is scooped, sifted, packed,
 * chopped, its moisture and brand.
 */
export const ingredients: { id: string; name: string; gPerCup: number; note?: string }[] = [
  { id: "water", name: "Water", gPerCup: 236.6 },
  { id: "milk", name: "Milk (whole)", gPerCup: 244 },
  { id: "cream", name: "Heavy cream", gPerCup: 238 },
  { id: "yogurt", name: "Plain yogurt", gPerCup: 245 },
  { id: "oil", name: "Vegetable oil", gPerCup: 218 },
  { id: "butter", name: "Butter", gPerCup: 227, note: "1 US stick = 1/2 cup ≈ 113 g" },
  { id: "honey", name: "Honey", gPerCup: 340 },
  { id: "maple", name: "Maple syrup", gPerCup: 315 },
  { id: "flour-ap", name: "All-purpose flour", gPerCup: 125, note: "spooned and leveled; scooping packs in more" },
  { id: "flour-bread", name: "Bread flour", gPerCup: 130, note: "spooned and leveled" },
  { id: "flour-ww", name: "Whole wheat flour", gPerCup: 120, note: "spooned and leveled" },
  { id: "almond-flour", name: "Almond flour", gPerCup: 96 },
  { id: "cornstarch", name: "Cornstarch", gPerCup: 128 },
  { id: "cocoa", name: "Cocoa powder", gPerCup: 85 },
  { id: "sugar", name: "Granulated sugar", gPerCup: 200 },
  { id: "brown-sugar", name: "Brown sugar (packed)", gPerCup: 220 },
  { id: "powdered-sugar", name: "Powdered sugar", gPerCup: 120, note: "unsifted" },
  { id: "salt", name: "Table salt", gPerCup: 288 },
  { id: "oats", name: "Rolled oats", gPerCup: 90 },
  { id: "rice", name: "White rice (uncooked)", gPerCup: 190 },
  { id: "choc-chips", name: "Chocolate chips", gPerCup: 170 },
  { id: "raisins", name: "Raisins", gPerCup: 150 },
  { id: "walnuts", name: "Walnuts (chopped)", gPerCup: 115 },
  { id: "peanut-butter", name: "Peanut butter", gPerCup: 258 },
  { id: "cheddar", name: "Cheddar (shredded)", gPerCup: 113 },
  { id: "parmesan", name: "Parmesan (finely grated)", gPerCup: 100 },
];

export const US_CUP_ML = (US_GALLON * 1000) / 16;

/** Generic linear/non-linear conversion, same semantics as the engine. */
export function convertUnits(units: Unit[], value: number, from: string, to: string): number {
  const f = units.find((u) => u.id === from);
  const t = units.find((u) => u.id === to);
  if (!f || !t) return NaN;
  const b = typeof f.toBase === "number" ? value * f.toBase : f.toBase(value);
  if (typeof t.toBase === "number") return b / t.toBase;
  if (!t.fromBase) return NaN;
  return t.fromBase(b);
}

/** Seconds to "1 h 2 min 3 s" style text. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "never";
  if (seconds < 1) return `${Number((seconds * 1000).toPrecision(3))} ms`;
  const s = Math.round(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (sec || parts.length === 0) parts.push(`${sec} s`);
  return parts.join(" ");
}

/** Download time in seconds: size in bits divided by effective rate. */
export function downloadSeconds(sizeBits: number, rateBps: number, overheadPct = 0): number {
  const eff = rateBps * (1 - overheadPct / 100);
  if (eff <= 0) return Infinity;
  return sizeBits / eff;
}
