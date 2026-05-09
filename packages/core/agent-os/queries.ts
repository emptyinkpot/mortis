import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const agentOSKeys = {
  all: (wsId: string) => ["agent-os", wsId] as const,
  summary: (wsId: string) => [...agentOSKeys.all(wsId), "summary"] as const,
};

export function agentOSSummaryOptions(wsId: string) {
  return queryOptions({
    queryKey: agentOSKeys.summary(wsId),
    queryFn: () => api.getAgentOSSummary({ workspace_id: wsId }),
  });
}
