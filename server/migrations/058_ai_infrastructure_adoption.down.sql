DELETE FROM studio_state
WHERE state_key IN (
  'ai_infra_langgraph',
  'ai_infra_letta_memory',
  'ai_infra_openhands_worker',
  'ai_infra_browser_use',
  'ai_infra_observability_stack',
  'ai_infra_internal_bus',
  'ai_infra_graph_database'
);
