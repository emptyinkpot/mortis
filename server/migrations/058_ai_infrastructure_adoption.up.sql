INSERT INTO studio_state (
  workspace_id, state_key, state_type, status, owner_role, summary, current_value, next_action, artifact_required, metadata
)
SELECT
  w.id,
  item.state_key,
  item.state_type,
  item.status,
  item.owner_role,
  item.summary,
  item.current_value::jsonb,
  item.next_action,
  item.artifact_required,
  item.metadata::jsonb
FROM workspace w
CROSS JOIN (
  VALUES
    (
      'ai_infra_langgraph',
      'external_infrastructure',
      'missing',
      'ceo',
      'Mortis is hand-writing shared state, checkpoint, routing, recovery, and internal bus pieces that should become LangGraph-compatible adapters instead of a larger custom AI OS.',
      '{"target":"LangGraph","priority":"P0","intended_scope":["runtime graph","shared state","checkpoint","workflow","resume","handoff"],"current_mortis_adapters":["agent_shared_threads","agent_cognitive_events","studio_state","role_actions","role_invocations"],"do_not":"rewrite the whole backend before defining adapter contracts"}',
      'Define LangGraph-compatible state schema: thread id, node, next node, checkpoint id, blocked reason, action ids, artifact ids, and resume command.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"prefer mature graph runtime over expanding custom dispatcher/state machines"}'
    ),
    (
      'ai_infra_letta_memory',
      'external_infrastructure',
      'missing',
      'ceo',
      'Mortis has SQL memory tables and persona state, but long-term memory retrieval/consolidation should align with Letta/MemGPT instead of growing ad hoc prompt memory.',
      '{"target":"Letta/MemGPT","priority":"P0","intended_scope":["working memory","episodic memory","semantic memory","social memory","identity memory","skill memory","consolidation"],"current_mortis_adapters":["agent_memories","agent_journals","agent_relationships","agent_emotions","agent_knowledge_items","agent_memory_items"]}',
      'Map existing memory tables to Letta-style memory blocks and define consolidation jobs before adding more memory prompt rules.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"do not keep adding persona prompt memory as the primary memory system"}'
    ),
    (
      'ai_infra_openhands_worker',
      'external_infrastructure',
      'missing',
      'builder',
      'Builder runtime is a minimal Codex worker. OpenHands should be evaluated as the mature worker runtime for shell/browser/file/repo planning loops, while Codex remains the current proven executor.',
      '{"target":"OpenHands","priority":"P1","intended_scope":["worker runtime","shell tools","browser tools","file editing","repo actions","planning loop"],"current_mortis_adapters":["builder-local-codex","tester-local-verifier","agent-workspaces","studio_artifacts"]}',
      'Create an OpenHands worker adapter contract that can consume role_actions and emit the same execution_report/studio_artifacts format.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"avoid rebuilding a full shell/browser worker loop by hand"}'
    ),
    (
      'ai_infra_browser_use',
      'external_infrastructure',
      'missing',
      'watcher',
      'Watcher needs real web/Bilibili/GitHub browsing and extraction. Browser Use should be evaluated before writing a custom Playwright agent.',
      '{"target":"Browser Use","priority":"P1","intended_scope":["web browsing","button clicks","search","content extraction","login-capable flows"],"current_mortis_adapters":["agent_feed_items","agent_saved_items","agent_knowledge_items","watcher_ingestion"]}',
      'Define browser-use ingestion jobs that write source URL, extracted summary, credibility, and OpenList artifact URI.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"do not hand-roll a general browser agent until Browser Use fit is evaluated"}'
    ),
    (
      'ai_infra_observability_stack',
      'external_infrastructure',
      'missing',
      'tester',
      'verification_evidence has CI/staging/observability fields, but real world readers are missing. Use Grafana/Loki/Prometheus/Sentry instead of inventing observability storage.',
      '{"target":"Grafana/Loki/Prometheus/Sentry","priority":"P1","intended_scope":["logs","metrics","errors","alerts","read-only AI queries"],"current_mortis_adapters":["verification_evidence.observability","studio_state.logs_monitoring"]}',
      'Provision read-only observability endpoints and connect them to Tester evidence readers with redaction.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"fill evidence missing fields with real read-only observability stack"}'
    ),
    (
      'ai_infra_internal_bus',
      'external_infrastructure',
      'missing',
      'ceo',
      'QQ should stay the public face. Internal agent events should move toward NATS or Redis Streams instead of expanding QQ/public chat as the work bus.',
      '{"target":"NATS or Redis Streams","priority":"P2","intended_scope":["builder.completed","tester.blocked","ci.failed","watcher.found_news","agent handoff events"],"current_mortis_adapters":["agent_cognitive_events","role_invocations","qq notifier"]}',
      'Choose NATS vs Redis Streams and write a small event adapter that mirrors existing DB events without changing public QQ behavior.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"do not use QQ group chat as internal event bus"}'
    ),
    (
      'ai_infra_graph_database',
      'external_infrastructure',
      'missing',
      'ceo',
      'Artifact graph is now relational in studio_artifacts. Neo4j should be evaluated once issue/action/commit/verification/deployment relationships outgrow SQL joins.',
      '{"target":"Neo4j","priority":"P2","intended_scope":["artifact graph","social graph","memory graph","root-cause relationships"],"current_mortis_adapters":["studio_artifacts","role_actions","role_invocations","agent_relationships","agent_knowledge_items"]}',
      'Keep SQL canonical for now; design an export/mirror model before introducing Neo4j.',
      true,
      '{"source":"AI Native Infrastructure recommendation","policy":"do not prematurely replace SQL; prepare graph-compatible edges first"}'
    )
) AS item(state_key, state_type, status, owner_role, summary, current_value, next_action, artifact_required, metadata)
ON CONFLICT (workspace_id, state_key) DO UPDATE SET
  state_type = EXCLUDED.state_type,
  status = EXCLUDED.status,
  owner_role = EXCLUDED.owner_role,
  summary = EXCLUDED.summary,
  current_value = EXCLUDED.current_value,
  next_action = EXCLUDED.next_action,
  artifact_required = EXCLUDED.artifact_required,
  metadata = EXCLUDED.metadata,
  updated_at = now();
