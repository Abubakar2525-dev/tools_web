import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/tools/background-remover";
const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9327;
const profile = await mkdtemp(join(tmpdir(), "bg-remover-smoke-"));
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;

try {
  let target;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch {
      // Chrome is still starting.
    }
    await pause(200);
  }
  if (!target) throw new Error("Could not connect to headless Chrome.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });
  const evaluate = async (expression, awaitPromise = true) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await pause(100);
  }

  const setup = await evaluate(`(async () => {
    const fast = document.querySelector('input[name="bg-model"][value="fast"]');
    if (!fast) return { error: "Fast model control was not found." };
    fast.click();
    const cpu = document.querySelector('input[type="radio"][value="wasm"]');
    if (!cpu) return { error: "CPU backend control was not found." };
    cpu.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f3f4f6';
    context.fillRect(0, 0, 96, 96);
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.arc(48, 48, 28, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'background-remover-smoke.png', { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('input[type="file"][accept*="image/png"]');
    if (!input) return { error: "Image input was not found." };
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  })()`);
  if (setup?.error) throw new Error(setup.error);

  let state;
  for (let attempt = 0; attempt < 900; attempt++) {
    state = await evaluate(`(() => {
      const text = document.body.innerText;
      if (text.includes('Done in')) return { status: 'done', text };
      if (text.includes('Couldn\\'t process') || text.includes('Couldn\\'t load the model'))
        return { status: 'error', text };
      return { status: 'waiting', text };
    })()`);
    if (state.status !== "waiting") break;
    await pause(200);
  }
  if (state?.status !== "done") {
    const lines = state?.text?.split("\n").filter(Boolean) ?? [];
    const useful = lines
      .filter((line) => /couldn|fail|error|model|GPU|CPU|WebAssembly|download|process/i.test(line))
      .slice(-30)
      .join(" | ");
    throw new Error(`Background remover did not complete. ${useful ?? "Timed out."}`);
  }
  console.log("Background remover smoke test OK: CPU model processed a generated PNG.");
} finally {
  socket?.close();
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    pause(3000),
  ]);
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  }).catch(() => undefined);
}
