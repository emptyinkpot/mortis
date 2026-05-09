import {
  actPage,
  closeTaskPages,
  getArtifactDir,
  getBrowserExecutablePath,
  listPages,
  openPage,
  verifyPage,
} from "./browser-manager.mjs";

const taskId = "demo";
const page = await openPage(taskId, "smoke", "https://example.com", {
  allowlist: ["example.com"],
  expectedUrl: "example.com",
  titleContains: "Example",
  selector: "h1",
});

console.log("BROWSER", getBrowserExecutablePath());
console.log("ARTIFACT_DIR", getArtifactDir());
console.log("OPEN", page);
console.log("VERIFY", await verifyPage(page.pageId));
console.log("ACT", await actPage(page.pageId, { type: "wait", value: 300 }));
console.log("LIST", await listPages(taskId));
console.log("CLOSE", await closeTaskPages(taskId));
