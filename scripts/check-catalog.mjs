import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");
const readSetStrings = (path, name) => {
  const match = read(path).match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
};

const rows = read("docs/tool-inventory.md")
  .split(/\r?\n/)
  .filter((line) => /^[a-z-]+ \| [a-z-]+ \| [a-z0-9-]+ \|/.test(line))
  .map((line) => {
    const [category, batch, slug] = line.split(" | ");
    return { category, batch, slug };
  });

const failures = [];
const duplicates = (items) => [...new Set(items.filter((item, index) => items.indexOf(item) !== index))];
const difference = (left, right) => left.filter((item) => !right.includes(item));

const inventorySlugs = rows.map(({ slug }) => slug);
for (const slug of duplicates(inventorySlugs)) failures.push(`Duplicate inventory slug: ${slug}`);

const curatedCatalogSlugs = [
  ...readSetStrings("src/content/catalog/index.ts", "curatedCatalogSlugs"),
  ...rows.filter(({ batch }) => batch === "existing" || batch === "alias").map(({ slug }) => slug),
];
for (const slug of difference(curatedCatalogSlugs, inventorySlugs)) failures.push(`Unknown curated catalog slug: ${slug}`);
for (const category of [...new Set(rows.map(({ category }) => category))]) {
  if (!rows.some((row) => row.category === category && curatedCatalogSlugs.includes(row.slug))) {
    failures.push(`Curated catalog category is empty: ${category}`);
  }
}

const regularBatches = [...new Set(rows.map(({ batch }) => batch).filter((batch) => batch !== "existing" && batch !== "alias"))];
for (const batch of regularBatches) {
  const expected = rows.filter((row) => row.batch === batch).map(({ slug }) => slug);
  const sourcePath = `src/content/catalog/tools/${batch}.ts`;
  if (!existsSync(join(root, sourcePath))) {
    failures.push(`Missing content file: ${sourcePath}`);
    continue;
  }

  const source = read(sourcePath);
  // Definitions deliberately excluded from the export (`tool.slug !== "x"`) are not live catalog entries.
  const disabled = [...source.matchAll(/\.slug\s*!==\s*"([^"]+)"/g)].map((match) => match[1]);
  const declared = [...source.matchAll(/\bslug:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((slug) => !disabled.includes(slug));
  for (const slug of difference(expected, declared)) failures.push(`Missing ${batch} content entry: ${slug}`);
  for (const slug of difference(declared, expected)) failures.push(`Unexpected ${batch} content entry: ${slug}`);
  for (const slug of duplicates(declared)) failures.push(`Duplicate ${batch} content entry: ${slug}`);
}

const existingSource = read("src/content/catalog/tools/existing.ts");
for (const { batch, slug } of rows.filter(({ batch }) => batch === "existing" || batch === "alias")) {
  if (!existingSource.includes(`"${slug}"`)) failures.push(`Missing ${batch} catalog entry: ${slug}`);
}

const catalogRoot = join(root, "src/components/tools/catalog");
const loaderFiles = readdirSync(catalogRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(catalogRoot, entry.name, "loaders.tsx"))
  .filter(existsSync);

const loaderEntries = loaderFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/^\s*(?:"([^"]+)"|([a-z][a-z0-9-]*)):\s*dynamic\(\(\)\s*=>\s*import\("\.\/([^"]+)"\)/gm)].map(
    ([, quotedSlug, bareSlug, imported]) => ({ slug: quotedSlug ?? bareSlug, imported, path }),
  );
});

const existingComponents = [...read("src/components/tools/catalog/existing.tsx").matchAll(/^\s*"([^"]+)":\s*dynamic/gm)].map(
  (match) => match[1],
);
const registered = [...loaderEntries.map(({ slug }) => slug), ...existingComponents];
const expectedPages = rows.filter(({ batch }) => batch !== "alias").map(({ slug }) => slug);

for (const slug of difference(expectedPages, registered)) failures.push(`Missing component registration: ${slug}`);
for (const slug of difference(registered, expectedPages)) failures.push(`Unexpected component registration: ${slug}`);
for (const slug of duplicates(registered)) failures.push(`Duplicate component registration: ${slug}`);

for (const { slug, imported, path } of loaderEntries) {
  if (slug !== imported) failures.push(`Loader key/import mismatch in ${path}: ${slug} -> ${imported}`);
  const componentPath = join(path, "..", `${imported}.tsx`);
  if (!existsSync(componentPath)) failures.push(`Missing component file for ${slug}: ${componentPath}`);
}

const studentTools = JSON.parse(read("src/content/student-reference.json"));
const curatedStudentSlugs = readSetStrings("src/content/student-catalog.ts", "curatedStudentToolSlugs");
const expectedStudentCounts = {
  "writing-and-text": 14,
  "research-and-citations": 8,
  math: 17,
  statistics: 14,
  physics: 16,
  chemistry: 12,
  engineering: 9,
  biology: 2,
  grades: 6,
  productivity: 17,
  finance: 9,
  career: 6,
  developer: 30,
  "presentations-and-diagrams": 3,
  everyday: 14,
};
if (studentTools.length !== 177) failures.push(`Expected 177 student tools, found ${studentTools.length}`);
for (const slug of duplicates(studentTools.map((tool) => tool.slug))) failures.push(`Duplicate student tool slug: ${slug}`);
for (const [category, count] of Object.entries(expectedStudentCounts)) {
  const actual = studentTools.filter((tool) => tool.category === category).length;
  if (actual !== count) failures.push(`Student category ${category}: expected ${count}, found ${actual}`);
}
for (const tool of studentTools) {
  if (!inventorySlugs.includes(tool.sourceSlug)) failures.push(`Missing source for student tool ${tool.slug}: ${tool.sourceSlug}`);
}
for (const slug of difference(curatedStudentSlugs, studentTools.map(({ slug }) => slug))) {
  failures.push(`Unknown curated student tool slug: ${slug}`);
}
for (const category of Object.keys(expectedStudentCounts)) {
  if (!studentTools.some((tool) => tool.category === category && curatedStudentSlugs.includes(tool.slug))) {
    failures.push(`Curated student category is empty: ${category}`);
  }
}

const aliasTargets = new Map(
  [...existingSource.matchAll(/\["([^"]+)",\s*"([^"]+)",/g)].map((match) => [match[1], match[2]]),
);
const legacyStudentComponents = [
  ...read("src/components/tools/registry.tsx").matchAll(/^\s*"([^"]+)":\s*[A-Z]/gm),
].map((match) => match[1]);
for (const tool of studentTools) {
  const aliasTarget = aliasTargets.get(tool.sourceSlug);
  if (aliasTarget && !legacyStudentComponents.includes(aliasTarget)) {
    failures.push(`Student tool ${tool.slug} uses alias ${tool.sourceSlug}, but component ${aliasTarget} is not registered`);
  }
}

if (failures.length) {
  console.error(`Catalog integrity check failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Catalog integrity OK: ${rows.length} entries, ${expectedPages.length} pages, ${regularBatches.length} implementation batches.`);
  console.log(`Student catalog OK: ${studentTools.length} routes across ${Object.keys(expectedStudentCounts).length} categories, backed by ${new Set(studentTools.map((tool) => tool.sourceSlug)).size} working engines.`);
  console.log(`Public curation OK: ${new Set(curatedCatalogSlugs).size} tools and ${curatedStudentSlugs.length} student tools, with every category represented.`);
}
