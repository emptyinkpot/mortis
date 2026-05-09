import { describe, it, expect } from "vitest";
import { paths, isGlobalPath } from "./paths";

describe("paths.workspace(slug)", () => {
  const ws = paths.workspace("acme");

  it("builds dashboard paths with slug prefix", () => {
    expect(ws.issues()).toBe("/acme/issues");
    expect(ws.issueDetail("abc-123")).toBe("/acme/issues/abc-123");
    expect(ws.projects()).toBe("/acme/projects");
    expect(ws.projectDetail("p1")).toBe("/acme/projects/p1");
    expect(ws.agentOS()).toBe("/acme/agent-os");
    expect(ws.manager()).toBe("/acme/manager");
    expect(ws.roles()).toBe("/acme/roles");
    expect(ws.autopilots()).toBe("/acme/autopilots");
    expect(ws.autopilotDetail("a1")).toBe("/acme/autopilots/a1");
    expect(ws.agents()).toBe("/acme/agents");
    expect(ws.internalChat()).toBe("/acme/internal-chat");
    expect(ws.inbox()).toBe("/acme/inbox");
    expect(ws.myIssues()).toBe("/acme/my-issues");
    expect(ws.overview()).toBe("/acme/overview");
    expect(ws.servers()).toBe("/acme/servers");
    expect(ws.deployments()).toBe("/acme/deployments");
    expect(ws.domains()).toBe("/acme/domains");
    expect(ws.atramentiHome()).toBe("/acme/atramenti");
    expect(ws.atramentiOverview()).toBe("/acme/atramenti/system-overview");
    expect(ws.atramentiNovel()).toBe("/acme/atramenti/novel");
    expect(ws.runtimes()).toBe("/acme/runtimes");
    expect(ws.skills()).toBe("/acme/skills");
    expect(ws.settings()).toBe("/acme/settings");
  });

  it("URL-encodes special characters in ids", () => {
    expect(ws.issueDetail("id with space")).toBe("/acme/issues/id%20with%20space");
  });
});

describe("paths (global)", () => {
  it("builds global paths without slug", () => {
    expect(paths.login()).toBe("/login");
    expect(paths.newWorkspace()).toBe("/workspaces/new");
    expect(paths.invite("inv-1")).toBe("/invite/inv-1");
    expect(paths.authCallback()).toBe("/auth/callback");
  });
});

describe("isGlobalPath", () => {
  it("returns true for pre-workspace routes", () => {
    expect(isGlobalPath("/login")).toBe(true);
    expect(isGlobalPath("/workspaces/new")).toBe(true);
    expect(isGlobalPath("/invite/abc")).toBe(true);
    expect(isGlobalPath("/auth/callback")).toBe(true);
  });

  it("returns false for workspace-scoped paths", () => {
    expect(isGlobalPath("/acme/issues")).toBe(false);
    expect(isGlobalPath("/")).toBe(false);
  });
});
