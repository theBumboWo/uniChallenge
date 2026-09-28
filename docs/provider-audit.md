# Provider Audit — Phase 0

**Date:** 2026-09-28
**Machine:** Windows (cdev0 desktop)

This audit documents the availability of each provider binary on the target development machine.
Required before Phase 3 (agent execution) work begins.

---

## Results

| Provider | Binary | Status | Version | Notes |
|----------|--------|--------|---------|-------|
| Kiro CLI | `kiro-cli` | ✅ **Available** | kiro-cli-chat 2.24.1 | ACP subcommand (`kiro-cli acp`) confirmed present. Kiro Crew supported (≥1.23 per design.md §3). |
| Kiro IDE | `kiro` | ✅ **Available** | 1.1.70 | Kiro IDE binary on PATH. Not used directly by the adapter (adapter uses `kiro-cli acp`). |
| OpenAI Codex | `codex` | ❌ **Not installed** | — | Install: `npm install -g @openai/codex` or via official Codex CLI docs. Req 8 adapter can be implemented but not end-to-end tested until installed. |
| Claude Code | `claude` | ❌ **Not installed** | — | Install: `npm install -g @anthropic-ai/claude-code`. Req 9 adapter can be implemented but not end-to-end tested until installed. |
| OpenCode | `opencode` | ❌ **Not installed** | — | Install: see https://opencode.ai. Req 10 adapter can be implemented but not end-to-end tested until installed. |
| OpenRouter | (no binary) | ⚠️ **API key not set** | — | No binary required. Needs `OPENROUTER_API_KEY` in Windows Credential Manager. This is the Phase 3 first-working-provider (design.md §1 vertical slice). Set key in app Settings before testing. |

---

## Phase Impact

### Phase 3 (Agent Execution Core)
- **OpenRouter** is confirmed as the right first provider — no binary needed, just an API key entered in settings.
- **KiroCLI** adapter can be tested end-to-end once the ACP protocol implementation is complete (binary is present, version 2.24 ≥ 1.23).

### Phase 4 (Full Provider Coverage)
- **Codex**, **Claude Code**, and **OpenCode** need to be installed before their adapters can be integration-tested.
- Install commands are noted above. Each can be installed by the user before Phase 4 begins.

### Risk #1 mitigation (design.md §10)
The audit confirms Risk #1 ("Provider CLIs not installed") applies to 3 of 5 providers.
OpenRouter (no binary) + Kiro CLI (already installed) provide two working providers for early testing.

---

## Install Commands (for Phase 4 prep)

```powershell
# OpenAI Codex CLI
npm install -g @openai/codex

# Claude Code
npm install -g @anthropic-ai/claude-code

# OpenCode — check https://opencode.ai for Windows installer
# or: npm install -g opencode (if published to npm)
```

---

## kiro-cli ACP Confirmation

```
$ kiro-cli acp --help
Start Agent Client Protocol (ACP) agent
Usage: kiro-cli.exe acp [OPTIONS]
```

ACP subcommand is available and functional. The `KiroCLIAdapter` can be implemented and tested in Phase 3/4.
