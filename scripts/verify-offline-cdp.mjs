const port = Number(process.env.CDP_PORT || 9333);
const username = process.env.ZS_TEST_USERNAME;
const password = process.env.ZS_TEST_PASSWORD;
if (!username || !password) throw new Error("Missing ZS_TEST_USERNAME/ZS_TEST_PASSWORD");

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return result;
  }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
  return response.json();
}
async function waitForTarget(type, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const target = (await json("/json/list")).find((item) => item.type === type);
    if (target) return target;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${type} target`);
}
async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(cdp, expression, label, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(cdp, expression)) return Date.now() - started;
    } catch {}
    await sleep(100);
  }
  const body = await evaluate(cdp, "document.body?.innerText || ''").catch(() => "");
  throw new Error(`Timed out waiting for ${label}. Body: ${body.slice(0, 700)}`);
}
async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitFor(cdp, "document.readyState === 'complete'", `load ${url}`, 30000);
}
async function clickText(cdp, selector, text) {
  return evaluate(
    cdp,
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => (node.innerText || node.getAttribute('aria-label') || '').trim().includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`,
  );
}
async function openMenuAndNavigate(cdp, linkText, headingText) {
  const started = Date.now();
  if (!(await clickText(cdp, "button", "Open menu"))) throw new Error("Mobile menu button not found");
  await waitFor(cdp, `[...document.querySelectorAll('a')].some(a => (a.innerText || '').trim().includes(${JSON.stringify(linkText)}))`, `${linkText} link`, 5000);
  if (!(await clickText(cdp, "a", linkText))) throw new Error(`${linkText} link not found`);
  await waitFor(cdp, `document.body?.innerText.includes(${JSON.stringify(headingText)})`, headingText, 10000);
  return Date.now() - started;
}

const pageTarget = await waitForTarget("page");
const page = new Cdp(pageTarget.webSocketDebuggerUrl);
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");
await page.send("Log.enable");
console.log("stage: browser connected");

const errors = [];
page.ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails?.text || "exception");
  if (message.method === "Network.loadingFailed") errors.push(`network: ${message.params.errorText}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    errors.push(`console: ${message.params.args?.map((arg) => arg.value || arg.description).join(" ")}`);
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    errors.push(`log: ${message.params.entry.text}`);
  }
});

await navigate(page, `https://zerosync.pages.dev/auth?verify=${Date.now()}`);
console.log("stage: auth loaded");
if (await evaluate(page, "!!(document.querySelector('#u') && document.querySelector('#p'))")) {
  await evaluate(page, "document.querySelector('#u').focus(); true");
  await page.send("Input.insertText", { text: username });
  await evaluate(page, "document.querySelector('#p').focus(); true");
  await page.send("Input.insertText", { text: password });
  await sleep(100);
  await evaluate(page, "document.querySelector('form').requestSubmit(); true");
}
await waitFor(page, "document.body?.innerText.includes('Businesses')", "online dashboard", 30000);
console.log("stage: signed in");

await openMenuAndNavigate(page, "Settings", "Settings");
console.log("stage: settings opened");
await waitFor(page, "document.body?.innerText.includes('Download for offline use')", "download button", 30000);
if (!(await clickText(page, "button", "Download for offline use"))) throw new Error("Download button not found");
const downloadStarted = Date.now();
let downloadBody = "";
while (Date.now() - downloadStarted < 90000) {
  downloadBody = await evaluate(page, "document.body?.innerText || ''");
  if (downloadBody.includes("Available offline on this device")) break;
  if (Date.now() - downloadStarted > 500 && downloadBody.includes("Download for offline use")) {
    throw new Error(`Download returned without saving. Body: ${downloadBody.slice(0, 900)} Errors: ${errors.join(' | ')}`);
  }
  await sleep(100);
}
if (!downloadBody.includes("Available offline on this device")) {
  throw new Error(`Download did not complete. Body: ${downloadBody.slice(0, 900)} Errors: ${errors.join(' | ')}`);
}
console.log("stage: download completed");

const downloaded = await evaluate(page, `(async () => {
  const me = JSON.parse(localStorage.getItem('zs:me:v1'));
  const meta = JSON.parse(localStorage.getItem('zs:offline-download-meta:v1:' + me.userId));
  const snapshot = JSON.parse(localStorage.getItem('zs:query-snapshot:v1:' + me.userId));
  const businesses = snapshot.state.queries.find(q => JSON.stringify(q.queryKey) === '["businesses"]')?.state?.data || [];
  const cacheNames = await caches.keys();
  const cacheEntries = {};
  for (const name of cacheNames) cacheEntries[name] = (await (await caches.open(name)).keys()).length;
  return { userId: me.userId, meta, queryCount: snapshot.state.queries.length, businessNames: businesses.map(b => b.name), cacheEntries };
})()`);

const workerTarget = await waitForTarget("service_worker", 15000);
const worker = new Cdp(workerTarget.webSocketDebuggerUrl);
await worker.send("Network.enable");
const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
await worker.send("Network.emulateNetworkConditions", offline);
await page.send("Network.emulateNetworkConditions", offline);
console.log("stage: network disabled");

// Destroy the running document, then cold-navigate through the service worker.
await navigate(page, "about:blank");
const coldStarted = Date.now();
await page.send("Page.navigate", { url: `https://zerosync.pages.dev/?offline=${Date.now()}` });
await waitFor(page, "document.body?.innerText.includes('Businesses') && document.body?.innerText.includes('Offline')", "cold offline dashboard", 30000);
console.log("stage: cold launch completed");
const coldLaunchMs = Date.now() - coldStarted;
const offlineDashboard = await evaluate(page, "document.body.innerText");

const timings = {};
timings.tasks = await openMenuAndNavigate(page, "My tasks", "My tasks");
timings.personal = await openMenuAndNavigate(page, "Personal", "Personal profiles");
timings.chat = await openMenuAndNavigate(page, "Chat", "Conversations");
timings.dashboard = await openMenuAndNavigate(page, "Dashboard", "Businesses");

console.log(JSON.stringify({ downloaded, coldLaunchMs, timings, offlineDashboard: offlineDashboard.slice(0, 500), errors }, null, 2));
worker.close();
page.close();
setTimeout(() => process.exit(0), 100);
