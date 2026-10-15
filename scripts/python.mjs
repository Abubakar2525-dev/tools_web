import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const virtualEnvPython = resolve(
  process.cwd(),
  process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
);
const python = existsSync(virtualEnvPython) ? virtualEnvPython : process.platform === "win32" ? "python.exe" : "python3";
const result = spawnSync(python, process.argv.slice(2), { cwd: process.cwd(), env: process.env, stdio: "inherit" });

if (result.error) {
  console.error(`[python] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
