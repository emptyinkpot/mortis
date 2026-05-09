export type ControlPlaneCheckStatus =
  | "healthy"
  | "degraded"
  | "offline"
  | "unknown";

export type ControlPlaneCheckKind = "http" | "tcp" | "file" | "derived" | "host-local";

export interface ControlPlaneHealthCheck {
  id: string;
  label: string;
  target: string;
  kind: ControlPlaneCheckKind;
  status: ControlPlaneCheckStatus;
  ok: boolean;
  statusCode?: number | null;
  latencyMs?: number | null;
  message?: string | null;
  updatedAt: string;
}

export interface ControlPlaneExecutionRoute {
  taskClass: string;
  ruleId: string | null;
  dispatcherServerId: string | null;
  targetServerId: string | null;
  fallbackTargetServerIds: string[];
  requiredRoles: string[];
  dispatchable: boolean;
  notes: string | null;
  warnings: string[];
}

export interface ControlPlaneServerView {
  id: string;
  name: string;
  enabled: boolean;
  host: string;
  hostname?: string | null;
  sshUser?: string | null;
  sshPort?: number | null;
  roles: string[];
  notes?: string | null;
  paths: Record<string, string>;
  services: Record<string, string>;
  domains: Record<string, string>;
  checks: ControlPlaneHealthCheck[];
  aggregateStatus: ControlPlaneCheckStatus;
}

export interface ControlPlaneDeploymentView {
  id: string;
  name: string;
  enabled: boolean;
  serverId: string;
  applicationId?: string | null;
  promotionGateId?: string | null;
  mode?: string | null;
  serviceName?: string | null;
  notes?: string | null;
  paths: Record<string, string>;
  publishStrategy?: string | null;
  buildWorkspace?: string | null;
  health: Record<string, string>;
  checks: ControlPlaneHealthCheck[];
  aggregateStatus: ControlPlaneCheckStatus;
}

export interface ControlPlaneDomainView {
  id: string;
  label: string;
  category: "domain" | "entrypoint";
  ownerType: "server" | "deployment" | "overlay";
  ownerId: string;
  domain?: string | null;
  url: string;
  checks: ControlPlaneHealthCheck[];
  aggregateStatus: ControlPlaneCheckStatus;
}

export interface ControlPlaneOverlayView {
  key: string;
  label: string;
  description?: string | null;
  primaryUrl?: string | null;
  defaultWorkspaceSlug?: string | null;
  checks: ControlPlaneHealthCheck[];
  aggregateStatus: ControlPlaneCheckStatus;
  meta: Record<string, string | number | boolean | null>;
  warnings: string[];
}

export interface ControlPlaneMcpView {
  id: string;
  name: string;
  enabled: boolean;
  category?: string | null;
  sourceRepoRoot?: string | null;
  sourcePath?: string | null;
  sourceEntrypoint?: string | null;
  resolvedSourcePath?: string | null;
  resolvedSourceEntrypoint?: string | null;
  runtimeServerId?: string | null;
  runtimeServerName?: string | null;
  runtimeMode?: string | null;
  runtimePath?: string | null;
  consumerConfigPath?: string | null;
  consumerAgentId?: string | null;
  consumerAgentName?: string | null;
  statusModel?: string | null;
  notes?: string | null;
  checks: ControlPlaneHealthCheck[];
  aggregateStatus: ControlPlaneCheckStatus;
}

export interface ControlPlaneOverview {
  counts: {
    servers: number;
    enabledServers: number;
    deployTargets: number;
    enabledTargets: number;
    domains: number;
    mcps: number;
  };
  dispatcherServerId: string | null;
  defaultTargetServerId: string | null;
  routes: ControlPlaneExecutionRoute[];
  warnings: string[];
  sourceRuntimeSplit: {
    srcRoot: string | null;
    runtimeRoot: string | null;
    backupRoot: string | null;
    mode: string | null;
    publishStrategy: string | null;
    buildWorkspace: string | null;
  };
  workstation: {
    status?: string | null;
    warnings: string[];
    dispatchable?: Record<string, boolean>;
  } | null;
}

export interface ControlPlaneSummary {
  source: {
    repoRoot: string | null;
    controlPlaneRoot: string | null;
    canonicalRepoUrl?: string | null;
    canonicalRepoDisplay?: string | null;
    status: "connected" | "missing";
    warnings: string[];
    loadedAt: string;
  };
  overview: ControlPlaneOverview;
  servers: ControlPlaneServerView[];
  deployments: ControlPlaneDeploymentView[];
  domains: ControlPlaneDomainView[];
  mcps: ControlPlaneMcpView[];
  overlays: {
    mortis: ControlPlaneOverlayView;
    qqBridge: ControlPlaneOverlayView;
  };
}
