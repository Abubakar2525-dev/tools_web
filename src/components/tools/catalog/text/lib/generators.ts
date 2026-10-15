/**
 * Username and random name generation with an injectable random source.
 * Word and name lists are original selections. Self-contained.
 */

export type RandInt = (max: number) => number;

/** Crypto-backed uniform integer in [0, max) without modulo bias. */
export const cryptoInt: RandInt = (max) => {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
};

const pick = <T,>(arr: readonly T[], r: RandInt): T => arr[r(arr.length)];

/* ------------------------------------------------------------------ */
/* Usernames                                                           */
/* ------------------------------------------------------------------ */

export const ADJECTIVES = `able agile amber ancient arctic azure bold brave breezy bright brisk calm candid cheery chill clever cobalt
cosmic cozy crimson crisp curious daring dapper dawn eager early earnest electric elegant epic fabled fair fearless fern fiery
fluffy flying frosty gentle giant gilded glad golden graceful grand happy hardy hazel hidden honest humble icy indigo ivory jade
jolly keen kind lively lucky lunar mellow merry mighty misty modest mossy nimble noble north odd olive orbit pastel patient
plucky polar proud quick quiet radiant rapid rare rustic sage salty scarlet silent silver sleepy snowy solar sonic spry steady
stellar stormy sunny swift tidy tiny topaz true urban vast velvet vivid warm whimsy wild windy wise witty young zany zen zesty`
  .split(/\s+/)
  .filter(Boolean);

export const NOUNS = `acorn anchor antler apple arrow aspen badger banjo beacon bear beetle biscuit bison blossom boulder breeze
brook buffalo cactus canyon cedar cheetah cherry cipher cloud clover comet compass coral cougar coyote crane cricket crow dingo
dolphin dragon drift eagle echo ember falcon fern finch firefly fjord flame forest fox galaxy gecko geyser glacier gopher harbor
hawk hedgehog heron hollow horizon husky island jaguar jasper kayak kestrel kite koala lagoon lantern lark lemur lynx magpie
maple marble meadow meteor mint moose moth nebula newt nova oak ocean orca otter owl panda panther parrot pebble pelican penguin
pepper pine pixel planet plum puffin quail quartz quasar rabbit raccoon raven reef river robin rocket sailor salmon sequoia
shadow sparrow sprout squid stone summit sun swan thistle thunder tiger timber toucan trail tulip tundra turtle valley violet
voyager walrus willow wolf wombat wren yak zebra zephyr`
  .split(/\s+/)
  .filter(Boolean);

/** Substrings rejected in any generated username (checked without separators, case-insensitive). */
const BLOCKED = ["fuck", "shit", "cunt", "nazi", "rape", "slut", "whore", "porn", "nigg", "fag", "kike", "spic", "retard", "dick", "cock", "piss", "twat", "bitch", "anal", "sex", "kkk", "hitler", "isis"];

export function isOffensive(s: string): boolean {
  const flat = s.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED.some((b) => flat.includes(b));
}

export type UsernameStyle = "pascal" | "lower" | "snake" | "dot" | "dash" | "camel";
export type NumberStyle = "none" | "2" | "3" | "4";

export type UsernameOptions = {
  style: UsernameStyle;
  numbers: NumberStyle;
  minLength: number;
  maxLength: number;
  keyword?: string;
  keywordPosition?: "start" | "end";
};

const capW = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

function assemble(parts: string[], style: UsernameStyle): string {
  switch (style) {
    case "pascal":
      return parts.map(capW).join("");
    case "camel":
      return parts.map((p, i) => (i ? capW(p) : p)).join("");
    case "lower":
      return parts.join("");
    case "snake":
      return parts.join("_");
    case "dot":
      return parts.join(".");
    case "dash":
      return parts.join("-");
  }
}

export function generateUsernames(count: number, o: UsernameOptions, r: RandInt): { names: string[]; error?: string } {
  const kw = (o.keyword ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (kw && isOffensive(kw)) return { names: [], error: "That keyword is blocked by the offensive-word filter." };
  if (o.minLength > o.maxLength) return { names: [], error: "Minimum length must not exceed maximum length." };
  const out = new Set<string>();
  let attempts = 0;
  while (out.size < count && attempts < count * 400) {
    attempts++;
    const parts = [pick(ADJECTIVES, r), pick(NOUNS, r)];
    if (kw) {
      if (o.keywordPosition === "end") parts[1] = kw;
      else parts[0] = kw;
    }
    let name = assemble(parts, o.style);
    if (o.numbers !== "none") {
      const digits = Number(o.numbers);
      const lo = digits === 2 ? 10 : digits === 3 ? 100 : 1000;
      const n = lo + r(lo * 9);
      name += (o.style === "snake" ? "_" : o.style === "dot" ? "." : o.style === "dash" ? "-" : "") + n;
    }
    if (name.length < o.minLength || name.length > o.maxLength) continue;
    if (isOffensive(name)) continue;
    out.add(name);
  }
  const names = [...out];
  return {
    names,
    error: names.length < count ? `Only ${names.length} usernames fit these length limits. Try widening the range.` : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

export type Gender = "feminine" | "masculine" | "neutral";

export type NameRegion = {
  id: string;
  label: string;
  familyFirst?: boolean;
  first: Record<Gender, string[]>;
  last: string[];
};

const L = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export const REGIONS: NameRegion[] = [
  {
    id: "west-africa",
    label: "West African",
    first: {
      feminine: L("Ama, Abena, Adaeze, Chiamaka, Folake, Ngozi, Yewande, Aissatou, Fatoumata, Efua, Nneka, Mariama"),
      masculine: L("Kwame, Kofi, Chinedu, Emeka, Tunde, Oluwaseun, Mamadou, Ibrahima, Yaw, Obinna, Babajide, Ousmane"),
      neutral: L("Ayo, Dayo, Ife, Nnamdi, Sena, Kelechi, Chidi, Esi"),
    },
    last: L("Mensah, Okafor, Adeyemi, Boateng, Diallo, Ndiaye, Owusu, Eze, Balogun, Traoré, Asante, Okonkwo, Camara, Nwosu"),
  },
  {
    id: "east-africa",
    label: "East African",
    first: {
      feminine: L("Amani, Wanjiru, Achieng, Halima, Nia, Zawadi, Makena, Saba, Tigist, Hiwot, Imani, Njeri"),
      masculine: L("Juma, Baraka, Kamau, Otieno, Mwangi, Abebe, Dawit, Tendai, Kiprono, Omondi, Bekele, Musa"),
      neutral: L("Akili, Neema, Baraka, Furaha, Jabari, Pendo"),
    },
    last: L("Kamau, Odhiambo, Mwangi, Wanjala, Kiptoo, Tesfaye, Haile, Nyerere, Mutua, Achieng, Kariuki, Girma"),
  },
  {
    id: "arabic",
    label: "Arabic",
    first: {
      feminine: L("Layla, Mariam, Noor, Yasmin, Amira, Huda, Salma, Rania, Lina, Aisha, Hala, Dina"),
      masculine: L("Omar, Youssef, Khalid, Tariq, Hassan, Karim, Samir, Ziad, Faisal, Bilal, Rami, Nabil"),
      neutral: L("Nour, Salam, Rayan, Ihsan, Wafa, Jihan"),
    },
    last: L("Haddad, Khalil, Mansour, Nasser, Saleh, Farouk, Hamdan, Aziz, Darwish, Sabbagh, Rahman, Qasim"),
  },
  {
    id: "south-asia",
    label: "South Asian",
    first: {
      feminine: L("Ananya, Priya, Aisha, Kavya, Meera, Saanvi, Fatima, Nadia, Ishita, Zara, Tanvi, Rhea"),
      masculine: L("Arjun, Rohan, Vikram, Aarav, Imran, Kabir, Rahul, Hamza, Sanjay, Farhan, Dev, Nikhil"),
      neutral: L("Kiran, Noor, Sami, Aru, Jaya, Ravi"),
    },
    last: L("Sharma, Patel, Khan, Iyer, Reddy, Chowdhury, Gupta, Singh, Siddiqui, Nair, Fernando, Perera, Hossain, Malik"),
  },
  {
    id: "chinese",
    label: "Chinese",
    familyFirst: true,
    first: {
      feminine: L("Mei, Xiu, Lan, Jing, Yan, Hui, Ling, Xiaoyu, Fang, Qing, Yue, Ying"),
      masculine: L("Wei, Jun, Hao, Lei, Ming, Tao, Bo, Jian, Zhen, Yong, Kai, Chen"),
      neutral: L("An, Yu, Xin, Le, Ning, Rui"),
    },
    last: L("Wang, Li, Zhang, Liu, Chen, Yang, Huang, Zhao, Wu, Zhou, Xu, Sun, Ma, Zhu"),
  },
  {
    id: "japanese",
    label: "Japanese",
    familyFirst: true,
    first: {
      feminine: L("Yui, Sakura, Hina, Aoi, Mio, Rin, Yuna, Haruka, Emi, Nanami, Saki, Akari"),
      masculine: L("Haruto, Ren, Sota, Yuto, Kaito, Daiki, Takumi, Riku, Kenji, Hiroshi, Shota, Yamato"),
      neutral: L("Hikaru, Makoto, Akira, Kaoru, Nao, Haru"),
    },
    last: L("Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Kato, Yoshida, Yamada, Mori, Ishikawa"),
  },
  {
    id: "korean",
    label: "Korean",
    familyFirst: true,
    first: {
      feminine: L("Ji-woo, Seo-yeon, Min-ji, Ha-eun, Su-bin, Ye-jin, Da-eun, Eun-ji, Hye-jin, Yu-na"),
      masculine: L("Min-jun, Seo-jun, Do-yun, Ji-ho, Hyun-woo, Jae-won, Sung-min, Tae-yang, Joon-ho, Woo-jin"),
      neutral: L("Ha-neul, Ji-min, Yoon, Bo-ra, Seung, Hae-sol"),
    },
    last: L("Kim, Lee, Park, Choi, Jung, Kang, Cho, Yoon, Jang, Lim, Han, Shin"),
  },
  {
    id: "southeast-asia",
    label: "Southeast Asian",
    first: {
      feminine: L("Linh, Mai, Thao, Siti, Dewi, Maria, Ploy, Anh, Ayu, Nurul, Malee, Rosa"),
      masculine: L("Minh, Duc, Tuan, Budi, Agus, Somchai, Rizal, Andre, Arif, Hieu, Nattapong, Jose"),
      neutral: L("Ari, Lan, Sinta, Kai, Nhat, Putri"),
    },
    last: L("Nguyen, Tran, Le, Pham, Santoso, Wijaya, Reyes, Santos, Cruz, Saetang, Lim, Tan, Hidayat, Bautista"),
  },
  {
    id: "latin-america",
    label: "Latin American / Spanish",
    first: {
      feminine: L("Sofía, Valentina, Camila, Isabella, Lucía, Gabriela, Mariana, Daniela, Paula, Elena, Ximena, Carmen"),
      masculine: L("Mateo, Santiago, Diego, Sebastián, Alejandro, Javier, Carlos, Andrés, Miguel, Tomás, Emiliano, Luis"),
      neutral: L("Ariel, Guadalupe, Cruz, Reyes, Celeste, René"),
    },
    last: L("García, Rodríguez, Martínez, Hernández, López, González, Pérez, Sánchez, Ramírez, Torres, Flores, Rivera, Gómez, Díaz"),
  },
  {
    id: "lusophone",
    label: "Portuguese / Brazilian",
    first: {
      feminine: L("Ana, Beatriz, Larissa, Mariana, Júlia, Leticia, Inês, Carolina, Fernanda, Rafaela, Joana, Bianca"),
      masculine: L("João, Pedro, Lucas, Gabriel, Rafael, Thiago, Gustavo, Bruno, Tiago, Felipe, Vinícius, Rodrigo"),
      neutral: L("Alex, Darci, Juraci, Iris, Cris, Dani"),
    },
    last: L("Silva, Santos, Oliveira, Souza, Costa, Pereira, Ferreira, Almeida, Carvalho, Ribeiro, Lima, Gomes, Rocha, Martins"),
  },
  {
    id: "western-europe",
    label: "Western European",
    first: {
      feminine: L("Emma, Charlotte, Olivia, Léa, Hannah, Chloé, Sophie, Grace, Clara, Amelia, Lena, Isla"),
      masculine: L("Liam, Oliver, Lucas, Noah, Louis, Felix, James, Hugo, Leon, Thomas, Arthur, Max"),
      neutral: L("Charlie, Sam, Robin, Alex, Jamie, Camille, Morgan, Dominique"),
    },
    last: L("Smith, Martin, Müller, Dubois, Jones, Schmidt, Bernard, Taylor, Fischer, Moreau, Walsh, Janssen, Murphy, Weber"),
  },
  {
    id: "nordic",
    label: "Nordic",
    first: {
      feminine: L("Freya, Astrid, Ingrid, Saga, Elin, Sigrid, Linnea, Maja, Liv, Ebba, Aino, Helmi"),
      masculine: L("Erik, Lars, Oskar, Magnus, Anders, Nils, Elias, Henrik, Leif, Sander, Eino, Aksel"),
      neutral: L("Kim, Alva, Eli, Love, Sky, Juno"),
    },
    last: L("Hansen, Johansson, Nielsen, Andersson, Larsen, Virtanen, Lindqvist, Berg, Korhonen, Dahl, Eriksen, Nyström"),
  },
  {
    id: "eastern-europe",
    label: "Eastern European",
    first: {
      feminine: L("Anna, Olga, Zofia, Katarina, Milena, Irina, Daria, Ivana, Natalia, Petra, Alina, Vesna"),
      masculine: L("Ivan, Piotr, Dmitri, Marek, Luka, Andrei, Tomasz, Nikola, Mikhail, Jakub, Bogdan, Stefan"),
      neutral: L("Sasha, Zhenya, Valya, Slava, Mischa, Jules"),
    },
    last: L("Novak, Kowalski, Ivanov, Horvat, Petrov, Nowak, Popescu, Kovač, Wiśniewska, Dvořák, Shevchenko, Popov, Jovanović, Kuznetsov"),
  },
  {
    id: "turkic-persian",
    label: "Turkish / Persian",
    first: {
      feminine: L("Elif, Zeynep, Defne, Azadeh, Shirin, Leyla, Ece, Parisa, Nilufar, Ayla, Mina, Selin"),
      masculine: L("Emir, Mehmet, Kerem, Arash, Dariush, Can, Kian, Omid, Murat, Arda, Reza, Bahram"),
      neutral: L("Deniz, Ruzgar, Ozan, Arya, Nima, Sahar"),
    },
    last: L("Yılmaz, Kaya, Demir, Şahin, Çelik, Ahmadi, Hosseini, Karimi, Rostami, Aydın, Öztürk, Moradi"),
  },
  {
    id: "indigenous-pacific",
    label: "Pacific Islander",
    first: {
      feminine: L("Leilani, Moana, Kalani, Mere, Aroha, Sina, Losa, Malia, Ana, Mele"),
      masculine: L("Keanu, Tane, Sione, Manu, Wiremu, Tavita, Kai, Rangi, Ioane, Lono"),
      neutral: L("Kai, Nalu, Ariki, Tui, Kahu, Noa"),
    },
    last: L("Tuilagi, Kealoha, Ngata, Fonoti, Tapsell, Kahananui, Faleolo, Parata, Vaifale, Akana"),
  },
];

export type NameOptions = {
  regions: string[];
  genders: Gender[];
  format: "full" | "first" | "last" | "full-middle";
  mixRegions?: boolean;
  localOrder?: boolean;
};

export type GeneratedName = { first: string; middle?: string; last: string; region: string; display: string };

export function generateNames(count: number, o: NameOptions, r: RandInt): GeneratedName[] {
  const pool = REGIONS.filter((g) => o.regions.includes(g.id));
  const regions = pool.length ? pool : REGIONS;
  const genders: Gender[] = o.genders.length ? o.genders : ["feminine", "masculine", "neutral"];
  const out: GeneratedName[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (out.length < count && attempts < count * 50) {
    attempts++;
    const reg = pick(regions, r);
    const gender = pick(genders, r);
    const first = pick(reg.first[gender], r);
    const lastRegion = o.mixRegions ? pick(regions, r) : reg;
    const last = pick(lastRegion.last, r);
    let middle: string | undefined;
    if (o.format === "full-middle") {
      do middle = pick(reg.first[pick(genders, r)], r);
      while (middle === first && reg.first[gender].length > 1);
    }
    let display: string;
    if (o.format === "first") display = first;
    else if (o.format === "last") display = last;
    else if (o.localOrder && reg.familyFirst && !o.mixRegions) display = [last, first].join(" ");
    else display = [first, middle, last].filter(Boolean).join(" ");
    if (seen.has(display) && attempts < count * 25) continue;
    seen.add(display);
    out.push({ first, middle, last, region: reg.label, display });
  }
  return out;
}

export function namesCsv(names: GeneratedName[]): string {
  const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["first_name,middle_name,last_name,full_name,region", ...names.map((n) => [n.first, n.middle ?? "", n.last, n.display, n.region].map(q).join(","))].join("\r\n");
}
