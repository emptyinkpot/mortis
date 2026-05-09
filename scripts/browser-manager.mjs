import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir =
  process.env.BROWSER_MANAGER_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "multica-browser-manager");
const browserCandidates = [
  process.env.BROWSER_MANAGER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Google\\Chrome\\Application\\chrome.exe"),
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Microsoft\\Edge\\Application\\msedge.exe"),
];
const browserPath = browserCandidates.find((candidate) => candidate && fs.existsSync(candidate));

if (!browserPath) {
  throw new Error("No local Edge/Chrome executable found. Set BROWSER_MANAGER_EXECUTABLE_PATH.");
}

fs.mkdirSync(artifactDir, { recursive: true });

const state = { browser: null, tasks: {}, pages: {}, next: 1 };

function sanitize(record) {
  const { page, ...rest } = record;
  return rest;
}

function screenshotPath(pageId, name) {
  return path.join(artifactDir, `${pageId}-${name}.png`);
}

function hostAllowed(url, allowlist = []) {
  return !allowlist.length || allowlist.includes(new URL(url).hostname);
}

async function ensureTask(taskId) {
  if (!state.browser) {
    state.browser = await chromium.launch({ headless: true, executablePath: browserPath });
  }
  if (!state.tasks[taskId]) {
    state.tasks[taskId] = { context: await state.browser.newContext(), pages: [] };
  }
  return state.tasks[taskId];
}

export function getBrowserExecutablePath() {
  return browserPath;
}

export async function openPage(taskId, purpose, url, expected = {}) {
  const task = await ensureTask(taskId);
  if (task.pages.length >= 3) throw new Error("max 3 tabs");
  const page = await task.context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const pageId = `p${state.next++}`;
  const record = {
    taskId,
    pageId,
    purpose,
    expected,
    page,
    status: "OPENED",
    actualUrl: page.url(),
    title: await page.title(),
    lastScreenshot: screenshotPath(pageId, "opened"),
  };
  await page.screenshot({ path: record.lastScreenshot });
  state.pages[pageId] = record;
  task.pages.push(pageId);
  return sanitize(record);
}

export async function verifyPage(pageId) {
  const record = state.pages[pageId];
  if (!record) throw new Error("page not found");
  record.actualUrl = record.page.url();
  record.title = await record.page.title();
  record.lastScreenshot = screenshotPath(pageId, "verified");
  await record.page.screenshot({ path: record.lastScreenshot });
  const failures = [];
  if (!hostAllowed(record.actualUrl, record.expected.allowlist)) failures.push("domain");
  if (record.expected.expectedUrl && !record.actualUrl.includes(record.expected.expectedUrl)) failures.push("url");
  if (record.expected.titleContains && !record.title.includes(record.expected.titleContains)) failures.push("title");
  if (record.expected.selector && !(await record.page.locator(record.expected.selector).count())) failures.push("selector");
  record.verificationResult = failures.length ? `wrong_page:${failures.join(",")}` : "ok";
  if (failures.length) {
    await record.page.close();
    record.status = "CLOSED";
    record.error = record.verificationResult;
  } else {
    record.status = "VERIFIED";
  }
  return sanitize(record);
}

export async function actPage(pageId, action) {
  const record = state.pages[pageId];
  if (!record || record.status !== "VERIFIED") throw new Error("page not verified");
  if (action.type === "click") await record.page.click(action.selector);
  if (action.type === "fill") await record.page.fill(action.selector, action.value || "");
  if (action.type === "press") await record.page.press(action.selector, action.value || "Enter");
  if (action.type === "wait") await record.page.waitForTimeout(action.value || 500);
  record.status = "DONE";
  record.actualUrl = record.page.url();
  record.title = await record.page.title();
  return sanitize(record);
}

export async function listPages(taskId) {
  return ((state.tasks[taskId] || {}).pages || []).map((pageId) => sanitize(state.pages[pageId]));
}

export async function closeTaskPages(taskId) {
  const task = state.tasks[taskId];
  if (!task) return [];
  for (const pageId of task.pages) {
    const record = state.pages[pageId];
    if (!record.page.isClosed()) await record.page.close();
    record.status = "CLOSED";
  }
  await task.context.close();
  delete state.tasks[taskId];
  if (!Object.keys(state.tasks).length && state.browser) {
    await state.browser.close();
    state.browser = null;
  }
  return task.pages.map((pageId) => sanitize(state.pages[pageId]));
}

export function getArtifactDir() {
  return artifactDir;
}

export async function runWorkflow(request = {}) {
  const taskId = request.taskId || `browser-${Date.now()}`;
  const result = {
    ok: false,
    taskId,
    browserPath,
    artifactDir,
  };

  try {
    if (!request.url) {
      throw new Error("url is required");
    }

    const purpose = request.purpose || "browser-task";
    const opened = await openPage(taskId, purpose, request.url, request.expected || {});
    result.opened = opened;

    const verified = await verifyPage(opened.pageId);
    result.verified = verified;
    if (verified.verificationResult !== "ok") {
      throw new Error(verified.verificationResult || "verification failed");
    }

    const acted = [];
    for (const action of request.actions || []) {
      acted.push(await actPage(opened.pageId, action));
    }
    result.acted = acted;
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (request.closeOnComplete !== false) {
      result.closed = await closeTaskPages(taskId);
    }
  }

  return result;
}

function parseCLIArgs(argv) {
  return {
    requestStdin: argv.includes("--request-stdin"),
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const args = parseCLIArgs(process.argv.slice(2));
  if (!args.requestStdin) {
    throw new Error("browser-manager CLI requires --request-stdin");
  }

  const raw = await readStdin();
  if (!raw) {
    throw new Error("browser-manager CLI received empty request");
  }

  let request;
  try {
    request = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid browser-manager request JSON: ${error.message}`);
  }

  const result = await runWorkflow(request);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    const result = {
      ok: false,
      browserPath,
      artifactDir,
      error: error instanceof Error ? error.message : String(error),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = 1;
  });
}
