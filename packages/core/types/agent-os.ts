import type { RoleChannel, RoleRiskLevel } from "./role";

export interface AgentOSSummary {
  workspace_id: string;
  counts: AgentOSCounts;
  roles: AgentOSRole[];
  agents: AgentOSAgent[];
  runtimes: AgentOSRuntime[];
  actions: AgentOSAction[];
  invocations: AgentOSInvocation[];
  artifacts: AgentOSArtifact[];
  studio_state: AgentOSStudioState[];
  generated_at: string;
}

export interface AgentOSCounts {
  roles: number;
  agents: number;
  runtimes: number;
  active_actions: number;
  recent_artifacts: number;
  blocked_state: number;
}

export interface AgentOSRole {
  id: string;
  name: string;
  title: string;
  default_runtime: string;
  approval_policy: string;
  built_in: boolean;
  permissions: string[];
  allowed_channels: RoleChannel[];
}

export interface AgentOSAgent {
  id: string;
  name: string;
  runtime_id: string;
  runtime_mode: string;
  status: string;
  visibility: string;
  owner_id: string | null;
  archived_at: string | null;
}

export interface AgentOSRuntime {
  id: string;
  name: string;
  runtime_mode: string;
  provider: string;
  status: string;
  owner_id: string | null;
  last_seen_at: string | null;
}

export interface AgentOSAction {
  id: string;
  invocation_id: string;
  role_id: string;
  role_name: string;
  role_title: string;
  action_type: string;
  risk_level: RoleRiskLevel;
  requires_approval: boolean;
  status: "proposed" | "awaiting_approval" | "approved" | "rejected" | "executed" | "cancelled";
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentOSInvocation {
  id: string;
  role_id: string;
  role_name: string;
  role_title: string;
  channel: RoleChannel;
  status: "routed" | "queued" | "running" | "completed" | "failed" | "blocked";
  command_type: string;
  risk_level: RoleRiskLevel;
  requires_approval: boolean;
  result: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentOSArtifact {
  id: string;
  role_action_id: string | null;
  invocation_id: string | null;
  thread_id: string;
  artifact_type: string;
  title: string;
  uri: string;
  status: "planned" | "created" | "verified" | "failed" | "blocked";
  produced_by: string;
  verification_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentOSStudioState {
  id: string;
  state_key: string;
  state_type: string;
  status: "ok" | "partial" | "missing" | "blocked" | "operator_only";
  owner_role: string;
  summary: string;
  current_value: Record<string, unknown>;
  next_action: string;
  artifact_required: boolean;
  updated_at: string;
}
