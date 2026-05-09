# Codex CLI Config Snapshot

This directory captures the Codex CLI runtime shape currently used on the ASUS-KL workstation for Mortis-related work.

It is intentionally a sanitized snapshot, not a drop-in copy of the workstation state. The real `auth.json`, SQLite state, logs, history, model cache, and temporary worktrees are not safe to commit.

## Snapshot

- Date: 2026-04-23
- Model provider: `crs`
- Model: `gpt-5.4`
- Reasoning effort: `high`
- Auth mode: `apikey`
- Approval policy: `never`
- Sandbox mode: `danger-full-access`
- Local OpenAI-compatible endpoint: `http://127.0.0.1:4411/openai/v1`

## Files

- `config.example.toml` - sanitized `config.toml` shape with MCP registrations and path placeholders.
- `auth.example.json` - placeholder auth file documenting the expected auth mode without a real key.

## Placeholders

- `<USER_HOME>` - local user home, for example `C:\Users\ASUS-KL` on the source workstation.
- `<CODEX_HOME>` - Codex home directory, normally `<USER_HOME>\\.codex`.
- `<PROJECTS_ROOT>` - local project root, for example `E:\My Project` on the source workstation.
- `<ATRAMENTI_CONSOLE_ROOT>` - checkout root containing the repo-managed Codex MCPs and skills.

## Excluded On Purpose

- API keys and bearer tokens.
- `history.jsonl`, SQLite state/log files, model caches, and session artifacts.
- Machine-local temporary worktrees under `.tmp`.
- Raw `AGENTS.md` backups and local config backup files unless a future task explicitly needs a sanitized export.

## Restore Notes

1. Copy `config.example.toml` to the target Codex home as `config.toml`.
2. Replace placeholders with local absolute paths.
3. Create `auth.json` locally from `auth.example.json` and fill the key from the local secret source.
4. Install MCP package dependencies before starting Codex, especially the local `chrome-devtools-mcp` runtime package.
5. Run a Codex startup or MCP health check before relying on the config for Mortis operations.
