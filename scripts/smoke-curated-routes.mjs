import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const manifest = JSON.parse(readFileSync(join(root, ".next", "prerender-manifest.json"), "utf8"));

const paths = Object.keys(manifest.routes)
  .filter((path) => /^\/(tools|student-tools)(?:\/|$)/.test(path))
  .sort();

const failureMarkers = [
  "This tool is not available yet",
  "Application error: a client-side exception has occurred",
  "Internal Server Error",
];

async function check(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected ${expectedStatus}, received ${response.status}`);
  }
  if (expectedStatus !== 200) return;

  const html = await response.text();
  const marker = failureMarkers.find((text) => html.includes(text));
  if (marker) throw new Error(`${path}: rendered failure marker: ${marker}`);
  if (!html.includes("<main")) throw new Error(`${path}: response does not contain the application shell`);
}

for (let index = 0; index < paths.length; index += 20) {
  await Promise.all(paths.slice(index, index + 20).map((path) => check(path)));
}

await Promise.all([
  check("/tools/not-a-real-tool", 404),
  check("/student-tools/not-a-real-student-tool", 404),
  check("/tools/category/not-a-real-category", 404),
  check("/student-tools/category/not-a-real-category", 404),
]);

const tools = paths.filter((path) => /^\/tools\/[^/]+$/.test(path)).length;
const studentTools = paths.filter((path) => /^\/student-tools\/[^/]+$/.test(path) && path !== "/student-tools/resources").length;
console.log(`Curated route smoke test OK: ${tools} tools, ${studentTools} student tools, ${paths.length} total pages.`);
