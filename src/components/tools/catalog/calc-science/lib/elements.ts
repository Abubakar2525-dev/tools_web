/**
 * The 118 chemical elements.
 *
 * Atomic weights: IUPAC abridged standard atomic weights (CIAAW, 2021
 * revision) given to five significant figures, or the conventional values
 * IUPAC publishes for elements with an interval (H, Li, B, C, N, O, Mg, Si,
 * S, Cl, Br, Tl). Values in brackets are elements with no stable isotopes:
 * the number is the mass number of the longest-lived (or best-known) isotope,
 * not a measured average mass.
 *
 * Electron configurations are ground-state shorthand. For Z ≥ 104 they are
 * theoretical predictions. Layout follows the IUPAC table (Lu and Lr in
 * group 3; La-Yb and Ac-No in the f-block rows).
 */

export type Category =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide";

export type Block = "s" | "p" | "d" | "f";

export interface Element {
  number: number;
  symbol: string;
  name: string;
  /** Display string, e.g. "12.011" or "[209]". */
  weightText: string;
  /** Numeric value for calculations (mass number for bracketed values). */
  weight: number;
  /** True when the weight is a mass number in brackets (no stable isotopes). */
  bracketed: boolean;
  /** 1-18, or null for f-block elements La-Yb and Ac-No. */
  group: number | null;
  period: number;
  block: Block;
  category: Category;
  config: string;
  /** True for superheavy elements whose chemistry/configuration is predicted. */
  predicted: boolean;
  /** Alternate spellings used for search (e.g. aluminium). */
  alt?: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  "alkali-metal": "Alkali metal",
  "alkaline-earth-metal": "Alkaline earth metal",
  "transition-metal": "Transition metal",
  "post-transition-metal": "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Reactive nonmetal",
  halogen: "Halogen",
  "noble-gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
};

type Code = "am" | "ae" | "tm" | "pt" | "md" | "nm" | "ha" | "ng" | "ln" | "ac";
const CODE: Record<Code, Category> = {
  am: "alkali-metal",
  ae: "alkaline-earth-metal",
  tm: "transition-metal",
  pt: "post-transition-metal",
  md: "metalloid",
  nm: "nonmetal",
  ha: "halogen",
  ng: "noble-gas",
  ln: "lanthanide",
  ac: "actinide",
};

// [symbol, name, weight, category, configuration]
const RAW: [string, string, string, Code, string][] = [
  ["H", "Hydrogen", "1.008", "nm", "1s1"],
  ["He", "Helium", "4.0026", "ng", "1s2"],
  ["Li", "Lithium", "6.94", "am", "[He] 2s1"],
  ["Be", "Beryllium", "9.0122", "ae", "[He] 2s2"],
  ["B", "Boron", "10.81", "md", "[He] 2s2 2p1"],
  ["C", "Carbon", "12.011", "nm", "[He] 2s2 2p2"],
  ["N", "Nitrogen", "14.007", "nm", "[He] 2s2 2p3"],
  ["O", "Oxygen", "15.999", "nm", "[He] 2s2 2p4"],
  ["F", "Fluorine", "18.998", "ha", "[He] 2s2 2p5"],
  ["Ne", "Neon", "20.180", "ng", "[He] 2s2 2p6"],
  ["Na", "Sodium", "22.990", "am", "[Ne] 3s1"],
  ["Mg", "Magnesium", "24.305", "ae", "[Ne] 3s2"],
  ["Al", "Aluminum", "26.982", "pt", "[Ne] 3s2 3p1"],
  ["Si", "Silicon", "28.085", "md", "[Ne] 3s2 3p2"],
  ["P", "Phosphorus", "30.974", "nm", "[Ne] 3s2 3p3"],
  ["S", "Sulfur", "32.06", "nm", "[Ne] 3s2 3p4"],
  ["Cl", "Chlorine", "35.45", "ha", "[Ne] 3s2 3p5"],
  ["Ar", "Argon", "39.95", "ng", "[Ne] 3s2 3p6"],
  ["K", "Potassium", "39.098", "am", "[Ar] 4s1"],
  ["Ca", "Calcium", "40.078", "ae", "[Ar] 4s2"],
  ["Sc", "Scandium", "44.956", "tm", "[Ar] 3d1 4s2"],
  ["Ti", "Titanium", "47.867", "tm", "[Ar] 3d2 4s2"],
  ["V", "Vanadium", "50.942", "tm", "[Ar] 3d3 4s2"],
  ["Cr", "Chromium", "51.996", "tm", "[Ar] 3d5 4s1"],
  ["Mn", "Manganese", "54.938", "tm", "[Ar] 3d5 4s2"],
  ["Fe", "Iron", "55.845", "tm", "[Ar] 3d6 4s2"],
  ["Co", "Cobalt", "58.933", "tm", "[Ar] 3d7 4s2"],
  ["Ni", "Nickel", "58.693", "tm", "[Ar] 3d8 4s2"],
  ["Cu", "Copper", "63.546", "tm", "[Ar] 3d10 4s1"],
  ["Zn", "Zinc", "65.38", "tm", "[Ar] 3d10 4s2"],
  ["Ga", "Gallium", "69.723", "pt", "[Ar] 3d10 4s2 4p1"],
  ["Ge", "Germanium", "72.630", "md", "[Ar] 3d10 4s2 4p2"],
  ["As", "Arsenic", "74.922", "md", "[Ar] 3d10 4s2 4p3"],
  ["Se", "Selenium", "78.971", "nm", "[Ar] 3d10 4s2 4p4"],
  ["Br", "Bromine", "79.904", "ha", "[Ar] 3d10 4s2 4p5"],
  ["Kr", "Krypton", "83.798", "ng", "[Ar] 3d10 4s2 4p6"],
  ["Rb", "Rubidium", "85.468", "am", "[Kr] 5s1"],
  ["Sr", "Strontium", "87.62", "ae", "[Kr] 5s2"],
  ["Y", "Yttrium", "88.906", "tm", "[Kr] 4d1 5s2"],
  ["Zr", "Zirconium", "91.224", "tm", "[Kr] 4d2 5s2"],
  ["Nb", "Niobium", "92.906", "tm", "[Kr] 4d4 5s1"],
  ["Mo", "Molybdenum", "95.95", "tm", "[Kr] 4d5 5s1"],
  ["Tc", "Technetium", "[98]", "tm", "[Kr] 4d5 5s2"],
  ["Ru", "Ruthenium", "101.07", "tm", "[Kr] 4d7 5s1"],
  ["Rh", "Rhodium", "102.91", "tm", "[Kr] 4d8 5s1"],
  ["Pd", "Palladium", "106.42", "tm", "[Kr] 4d10"],
  ["Ag", "Silver", "107.87", "tm", "[Kr] 4d10 5s1"],
  ["Cd", "Cadmium", "112.41", "tm", "[Kr] 4d10 5s2"],
  ["In", "Indium", "114.82", "pt", "[Kr] 4d10 5s2 5p1"],
  ["Sn", "Tin", "118.71", "pt", "[Kr] 4d10 5s2 5p2"],
  ["Sb", "Antimony", "121.76", "md", "[Kr] 4d10 5s2 5p3"],
  ["Te", "Tellurium", "127.60", "md", "[Kr] 4d10 5s2 5p4"],
  ["I", "Iodine", "126.90", "ha", "[Kr] 4d10 5s2 5p5"],
  ["Xe", "Xenon", "131.29", "ng", "[Kr] 4d10 5s2 5p6"],
  ["Cs", "Cesium", "132.91", "am", "[Xe] 6s1"],
  ["Ba", "Barium", "137.33", "ae", "[Xe] 6s2"],
  ["La", "Lanthanum", "138.91", "ln", "[Xe] 5d1 6s2"],
  ["Ce", "Cerium", "140.12", "ln", "[Xe] 4f1 5d1 6s2"],
  ["Pr", "Praseodymium", "140.91", "ln", "[Xe] 4f3 6s2"],
  ["Nd", "Neodymium", "144.24", "ln", "[Xe] 4f4 6s2"],
  ["Pm", "Promethium", "[145]", "ln", "[Xe] 4f5 6s2"],
  ["Sm", "Samarium", "150.36", "ln", "[Xe] 4f6 6s2"],
  ["Eu", "Europium", "151.96", "ln", "[Xe] 4f7 6s2"],
  ["Gd", "Gadolinium", "157.25", "ln", "[Xe] 4f7 5d1 6s2"],
  ["Tb", "Terbium", "158.93", "ln", "[Xe] 4f9 6s2"],
  ["Dy", "Dysprosium", "162.50", "ln", "[Xe] 4f10 6s2"],
  ["Ho", "Holmium", "164.93", "ln", "[Xe] 4f11 6s2"],
  ["Er", "Erbium", "167.26", "ln", "[Xe] 4f12 6s2"],
  ["Tm", "Thulium", "168.93", "ln", "[Xe] 4f13 6s2"],
  ["Yb", "Ytterbium", "173.05", "ln", "[Xe] 4f14 6s2"],
  ["Lu", "Lutetium", "174.97", "ln", "[Xe] 4f14 5d1 6s2"],
  ["Hf", "Hafnium", "178.49", "tm", "[Xe] 4f14 5d2 6s2"],
  ["Ta", "Tantalum", "180.95", "tm", "[Xe] 4f14 5d3 6s2"],
  ["W", "Tungsten", "183.84", "tm", "[Xe] 4f14 5d4 6s2"],
  ["Re", "Rhenium", "186.21", "tm", "[Xe] 4f14 5d5 6s2"],
  ["Os", "Osmium", "190.23", "tm", "[Xe] 4f14 5d6 6s2"],
  ["Ir", "Iridium", "192.22", "tm", "[Xe] 4f14 5d7 6s2"],
  ["Pt", "Platinum", "195.08", "tm", "[Xe] 4f14 5d9 6s1"],
  ["Au", "Gold", "196.97", "tm", "[Xe] 4f14 5d10 6s1"],
  ["Hg", "Mercury", "200.59", "tm", "[Xe] 4f14 5d10 6s2"],
  ["Tl", "Thallium", "204.38", "pt", "[Xe] 4f14 5d10 6s2 6p1"],
  ["Pb", "Lead", "207.2", "pt", "[Xe] 4f14 5d10 6s2 6p2"],
  ["Bi", "Bismuth", "208.98", "pt", "[Xe] 4f14 5d10 6s2 6p3"],
  ["Po", "Polonium", "[209]", "pt", "[Xe] 4f14 5d10 6s2 6p4"],
  ["At", "Astatine", "[210]", "ha", "[Xe] 4f14 5d10 6s2 6p5"],
  ["Rn", "Radon", "[222]", "ng", "[Xe] 4f14 5d10 6s2 6p6"],
  ["Fr", "Francium", "[223]", "am", "[Rn] 7s1"],
  ["Ra", "Radium", "[226]", "ae", "[Rn] 7s2"],
  ["Ac", "Actinium", "[227]", "ac", "[Rn] 6d1 7s2"],
  ["Th", "Thorium", "232.04", "ac", "[Rn] 6d2 7s2"],
  ["Pa", "Protactinium", "231.04", "ac", "[Rn] 5f2 6d1 7s2"],
  ["U", "Uranium", "238.03", "ac", "[Rn] 5f3 6d1 7s2"],
  ["Np", "Neptunium", "[237]", "ac", "[Rn] 5f4 6d1 7s2"],
  ["Pu", "Plutonium", "[244]", "ac", "[Rn] 5f6 7s2"],
  ["Am", "Americium", "[243]", "ac", "[Rn] 5f7 7s2"],
  ["Cm", "Curium", "[247]", "ac", "[Rn] 5f7 6d1 7s2"],
  ["Bk", "Berkelium", "[247]", "ac", "[Rn] 5f9 7s2"],
  ["Cf", "Californium", "[251]", "ac", "[Rn] 5f10 7s2"],
  ["Es", "Einsteinium", "[252]", "ac", "[Rn] 5f11 7s2"],
  ["Fm", "Fermium", "[257]", "ac", "[Rn] 5f12 7s2"],
  ["Md", "Mendelevium", "[258]", "ac", "[Rn] 5f13 7s2"],
  ["No", "Nobelium", "[259]", "ac", "[Rn] 5f14 7s2"],
  ["Lr", "Lawrencium", "[266]", "ac", "[Rn] 5f14 7s2 7p1"],
  ["Rf", "Rutherfordium", "[267]", "tm", "[Rn] 5f14 6d2 7s2"],
  ["Db", "Dubnium", "[268]", "tm", "[Rn] 5f14 6d3 7s2"],
  ["Sg", "Seaborgium", "[269]", "tm", "[Rn] 5f14 6d4 7s2"],
  ["Bh", "Bohrium", "[270]", "tm", "[Rn] 5f14 6d5 7s2"],
  ["Hs", "Hassium", "[269]", "tm", "[Rn] 5f14 6d6 7s2"],
  ["Mt", "Meitnerium", "[278]", "tm", "[Rn] 5f14 6d7 7s2"],
  ["Ds", "Darmstadtium", "[281]", "tm", "[Rn] 5f14 6d8 7s2"],
  ["Rg", "Roentgenium", "[282]", "tm", "[Rn] 5f14 6d9 7s2"],
  ["Cn", "Copernicium", "[285]", "tm", "[Rn] 5f14 6d10 7s2"],
  ["Nh", "Nihonium", "[286]", "pt", "[Rn] 5f14 6d10 7s2 7p1"],
  ["Fl", "Flerovium", "[289]", "pt", "[Rn] 5f14 6d10 7s2 7p2"],
  ["Mc", "Moscovium", "[290]", "pt", "[Rn] 5f14 6d10 7s2 7p3"],
  ["Lv", "Livermorium", "[293]", "pt", "[Rn] 5f14 6d10 7s2 7p4"],
  ["Ts", "Tennessine", "[294]", "ha", "[Rn] 5f14 6d10 7s2 7p5"],
  ["Og", "Oganesson", "[294]", "ng", "[Rn] 5f14 6d10 7s2 7p6"],
];

const ALT: Record<string, string> = { Al: "aluminium", Cs: "caesium", S: "sulphur" };
const PERIOD_END = [2, 10, 18, 36, 54, 86, 118];

/** Period, group and block from the atomic number (IUPAC layout). */
export function position(z: number): { period: number; group: number | null; block: Block } {
  const period = PERIOD_END.findIndex((e) => z <= e) + 1;
  const start = period === 1 ? 1 : PERIOD_END[period - 2] + 1;
  const k = z - start + 1;
  if (period === 1) return { period, group: z === 1 ? 1 : 18, block: "s" };
  if (period <= 3) {
    const group = k <= 2 ? k : k + 10;
    return { period, group, block: k <= 2 ? "s" : "p" };
  }
  if (period <= 5) return { period, group: k, block: k <= 2 ? "s" : k <= 12 ? "d" : "p" };
  if (k <= 2) return { period, group: k, block: "s" };
  if (k <= 16) return { period, group: null, block: "f" };
  if (k === 17) return { period, group: 3, block: "d" };
  const group = k - 14;
  return { period, group, block: group <= 12 ? "d" : "p" };
}

export const ELEMENTS: Element[] = RAW.map(([symbol, name, w, code, config], i) => {
  const number = i + 1;
  const bracketed = w.startsWith("[");
  const pos = position(number);
  return {
    number,
    symbol,
    name,
    weightText: w,
    weight: Number(w.replace(/[[\]]/g, "")),
    bracketed,
    ...pos,
    category: CODE[code],
    config,
    predicted: number >= 104,
    alt: ALT[symbol],
  };
});

export const BY_SYMBOL: ReadonlyMap<string, Element> = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function getElement(symbol: string): Element | undefined {
  return BY_SYMBOL.get(symbol);
}
