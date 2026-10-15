import { readFileSync } from "node:fs";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const allTools = JSON.parse(readFileSync(new URL("../src/content/student-reference.json", import.meta.url), "utf8"));
const catalogSource = readFileSync(new URL("../src/content/student-catalog.ts", import.meta.url), "utf8");
const curatedBlock = catalogSource.match(/const curatedStudentToolSlugs = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
const curatedSlugs = new Set([...curatedBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
const tools = allTools.filter((tool) => curatedSlugs.has(tool.slug));
const legacySource = readFileSync(new URL("../src/content/tools-student.ts", import.meta.url), "utf8");
const legacySlugs = [...legacySource.matchAll(/^    slug: "([^"]+)",/gm)].map((match) => match[1]);
const categories = [...new Set(allTools.map((tool) => tool.category))];

async function check(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, received ${response.status}`);
  if (expectedStatus === 200) {
    const html = await response.text();
    if (html.includes("This tool is not available yet")) throw new Error(`${path}: component is not registered`);
  }
}

const paths = [
  "/student-tools",
  ...categories.map((category) => `/student-tools/category/${category}`),
  ...new Set([...tools.map((tool) => `/student-tools/${tool.slug}`), ...legacySlugs.map((slug) => `/student-tools/${slug}`)]),
];

for (let index = 0; index < paths.length; index += 20) {
  await Promise.all(paths.slice(index, index + 20).map((path) => check(path)));
}
await check("/student-tools/not-a-real-student-tool", 404);
await check("/student-tools/category/not-a-real-category", 404);

console.log(`Student route smoke test OK: ${tools.length} curated tools plus legacy routes, ${categories.length} categories, directory and 404 handling.`);
