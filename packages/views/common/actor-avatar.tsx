"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useWorkspaceId } from "@multica/core/hooks";
import { agentListOptions } from "@multica/core/workspace/queries";
import { ActorAvatar as ActorAvatarBase } from "@multica/ui/components/common/actor-avatar";
import { useActorName } from "@multica/core/workspace/hooks";
import {
  buildNapcatQqAvatarUrl,
  resolveBoundNapcatAccount,
} from "../agents/napcat";

interface ActorAvatarProps {
  actorType: string;
  actorId: string;
  size?: number;
  className?: string;
}

export function ActorAvatar({ actorType, actorId, size, className }: ActorAvatarProps) {
  const wsId = useWorkspaceId();
  const { getActorName, getActorInitials, getActorAvatarUrl } = useActorName();
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const napcatAccountsSeedAgentId = useMemo(
    () => agents.find((agent) => !agent.archived_at)?.id ?? agents[0]?.id ?? "",
    [agents],
  );
  const { data: napcatAccounts = [] } = useQuery({
    queryKey: ["agents", wsId, "napcat-accounts", napcatAccountsSeedAgentId],
    queryFn: () => api.listAgentNapcatAccounts(napcatAccountsSeedAgentId),
    enabled: actorType === "agent" && !!napcatAccountsSeedAgentId,
    staleTime: 60_000,
  });
  const avatarUrl = useMemo(() => {
    const directAvatarUrl = getActorAvatarUrl(actorType, actorId);
    if (actorType !== "agent") {
      return directAvatarUrl;
    }

    // Bound NapCat/QQ avatars are the canonical agent-facing identity source.
    const agent = agents.find((item) => item.id === actorId);
    const napcatAvatarUrl = buildNapcatQqAvatarUrl(
      agent ? resolveBoundNapcatAccount(agent, napcatAccounts)?.qq_uin : null,
    );
    return napcatAvatarUrl ?? directAvatarUrl;
  }, [actorId, actorType, agents, getActorAvatarUrl, napcatAccounts]);

  return (
    <ActorAvatarBase
      name={getActorName(actorType, actorId)}
      initials={getActorInitials(actorType, actorId)}
      avatarUrl={avatarUrl}
      isAgent={actorType === "agent"}
      size={size}
      className={className}
    />
  );
}
