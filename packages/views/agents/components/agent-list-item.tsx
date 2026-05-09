"use client";

import { useMemo } from "react";
import { Cloud, Monitor } from "lucide-react";
import type { Agent, Issue, NapcatAccount } from "@multica/core/types";
import { ActorAvatar } from "../../common/actor-avatar";
import {
  formatNapcatBinding,
  resolveBoundNapcatAccount,
} from "../napcat";
import { deriveAgentActivityStatus } from "../agent-activity-status";

export function AgentListItem({
  agent,
  issues,
  napcatAccounts,
  isSelected,
  onClick,
}: {
  agent: Agent;
  issues: Issue[];
  napcatAccounts: NapcatAccount[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = deriveAgentActivityStatus(agent, issues);
  const isArchived = !!agent.archived_at;
  const boundNapcatAccount = useMemo(
    () => resolveBoundNapcatAccount(agent, napcatAccounts),
    [agent, napcatAccounts],
  );
  const bindingLabel = formatNapcatBinding(boundNapcatAccount);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <ActorAvatar
        actorType="agent"
        actorId={agent.id}
        size={32}
        className={`rounded-lg ${isArchived ? "opacity-50 grayscale" : ""}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${isArchived ? "text-muted-foreground" : ""}`}>{agent.name}</span>
          {agent.runtime_mode === "cloud" ? (
            <Cloud className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Monitor className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {isArchived ? (
            <span className="text-xs text-muted-foreground">Archived</span>
          ) : (
            <>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              <span className={`text-xs ${st.color}`}>{st.label}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="truncate text-xs text-muted-foreground" title={bindingLabel}>
            {bindingLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
