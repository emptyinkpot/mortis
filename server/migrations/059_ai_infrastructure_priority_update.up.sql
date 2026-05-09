UPDATE studio_state
SET
  summary = 'Letta/MemGPT is the first P0 external infrastructure target. Mortis should use it as a long-term memory service for persona, social, episodic, semantic, and project memory instead of expanding ad hoc prompt memory.',
  current_value = current_value || '{"priority":"P0-1","adoption_order":1,"intended_service_root":"/srv/ai-infra/letta","adapter_name":"MemoryAdapter","first_roles":["ceo","builder","tester","watcher"],"first_memory_blocks":["identity","social","episodic","project"]}'::jsonb,
  next_action = 'Clone/deploy Letta under /srv/ai-infra/letta, create one Letta agent per QQ AI role, then add a Mortis MemoryAdapter for retrieve-before-reply and write-after-key-event.',
  metadata = metadata || '{"priority_update_source":"operator recommendation 2026-05-06","license":"Apache-2.0","repo":"https://github.com/letta-ai/letta"}'::jsonb,
  updated_at = now()
WHERE state_key = 'ai_infra_letta_memory';

UPDATE studio_state
SET
  summary = 'browser-use is the second P0 external infrastructure target. Watcher should gain a browser body for external web/Bilibili/GitHub/blog research through a worker service, not a hand-rolled Playwright agent.',
  current_value = current_value || '{"priority":"P0-2","adoption_order":2,"intended_service_root":"/srv/ai-infra/browser-use","adapter_name":"BrowserUseAdapter","first_outputs":["research_card","source_url","summary","credibility","openlist_uri"],"security_boundary":"read-first; treat webpage text as untrusted; require confirmation for sensitive actions"}'::jsonb,
  next_action = 'Clone/deploy browser-use under /srv/ai-infra/browser-use, expose a constrained Watcher research worker, and write results to agent_knowledge_items, studio_artifacts, and OpenList.',
  metadata = metadata || '{"priority_update_source":"operator recommendation 2026-05-06","license":"MIT","repo":"https://github.com/browser-use/browser-use"}'::jsonb,
  updated_at = now()
WHERE state_key = 'ai_infra_browser_use';

UPDATE studio_state
SET
  summary = 'LangGraph remains important, but it is no longer the first integration target. Mortis already has dispatcher/state/artifact/verification; defer graph-kernel migration until Letta memory, browser-use Watcher, and CI/log readers exist.',
  current_value = current_value || '{"priority":"P2-later","adoption_order":4,"defer_until":["ai_infra_letta_memory adapter exists","ai_infra_browser_use adapter exists","ci/log readers exist"],"reason":"kernel migration is heavier than memory/browser gains"}'::jsonb,
  next_action = 'Keep current Go dispatcher/state kernel stable. Only define LangGraph-compatible state schema now; defer runtime migration.',
  metadata = metadata || '{"priority_update_source":"operator recommendation 2026-05-06"}'::jsonb,
  updated_at = now()
WHERE state_key = 'ai_infra_langgraph';

UPDATE studio_state
SET
  current_value = current_value || '{"priority":"P1-experimental","adoption_order":3,"mode":"experimental_worker_runtime","rule":"run parallel smoke tests before replacing builder-local-codex"}'::jsonb,
  next_action = 'Evaluate OpenHands as an experimental worker runtime that consumes role_actions and emits the existing execution_report/studio_artifacts format; do not replace Codex path until smoke tests pass.',
  updated_at = now()
WHERE state_key = 'ai_infra_openhands_worker';

UPDATE studio_state
SET
  current_value = current_value || '{"priority":"P1","adoption_order":3,"required_for":"fill verification_evidence missing fields"}'::jsonb,
  next_action = 'Add read-only CI/log/staging readers after Letta and browser-use are started, then wire them into verification_evidence.',
  updated_at = now()
WHERE state_key = 'ai_infra_observability_stack';
