/**
 * Task Submission Form — Req 6.1, 6.2
 *
 * Accessible via Full Workspace sidebar and Ctrl+Shift+N shortcut.
 * Fields: prompt (10–4000 chars), creature selector, provider selector,
 * model selector (populated from provider's discovered model list).
 * Inline validation on submit attempt (Req 6.2).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import type { CreatureId, ProviderId, ModelInfo } from "../store/appStore";
import { submitTask } from "../agents/TaskOrchestrator";
import { getAdapter } from "../adapters/types";
import { getCredential } from "../services/credentialService";

const CREATURE_OPTIONS: { id: CreatureId; label: string; icon: string }[] = [
  { id: "builder",    label: "The Builder",    icon: "⚙️"  },
  { id: "researcher", label: "The Researcher", icon: "🦉"  },
  { id: "debugger",   label: "The Debugger",   icon: "🐛"  },
];

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: "openrouter",   label: "OpenRouter"    },
  { id: "openai_codex", label: "OpenAI Codex"  },
  { id: "claude_code",  label: "Claude Code"   },
  { id: "opencode",     label: "OpenCode"       },
  { id: "kiro_cli",     label: "Kiro CLI"       },
];

interface Props {
  onClose?: () => void;
}

export default function TaskForm({ onClose }: Props) {
  const [prompt, setPrompt]           = useState("");
  const [creature, setCreature]       = useState<CreatureId>("builder");
  const [provider, setProvider]       = useState<ProviderId>("openrouter");
  const [model, setModel]             = useState("");
  const [models, setModels]           = useState<ModelInfo[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const providers = useAppStore((s) => s.providers);

  // Focus textarea on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Load models when provider changes
  useEffect(() => {
    setModels([]);
    setModel("");
    const adapter = getAdapter(provider);
    if (!adapter) return;

    let cancelled = false;
    getCredential(provider).then(async (cred) => {
      if (cancelled || !cred) return;
      try {
        const list = await adapter.listModels({ providerId: provider, value: cred });
        if (!cancelled) {
          setModels(list);
          if (list.length > 0) setModel(list[0].id);
        }
      } catch { /* no models available */ }
    });
    return () => { cancelled = true; };
  }, [provider]);

  // Inline validation (Req 6.2)
  const validatePrompt = useCallback((value: string): boolean => {
    if (value.length < 10) {
      setPromptError("Prompt must be at least 10 characters.");
      return false;
    }
    if (value.length > 4000) {
      setPromptError("Prompt must be 4000 characters or fewer.");
      return false;
    }
    setPromptError(null);
    return true;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validatePrompt(prompt)) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitTask({ prompt, creatureId: creature, providerId: provider, modelId: model });
      setPrompt("");
      onClose?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [prompt, creature, provider, model, onClose, validatePrompt]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
    if (e.key === "Escape") onClose?.();
  }, [handleSubmit, onClose]);

  const providerAvailable = providers[provider]?.available;
  const charCount = prompt.length;

  return (
    <div style={formStyle} role="form" aria-label="Submit a task">
      <div style={titleStyle}>New Task</div>

      {/* Prompt field */}
      <div style={fieldStyle}>
        <label htmlFor="task-prompt" style={labelStyle}>Prompt</label>
        <textarea
          id="task-prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (promptError) validatePrompt(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Describe the task… (Ctrl+Enter to submit)"
          rows={5}
          maxLength={4000}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: "100px",
            borderColor: promptError ? "#e05050" : "var(--color-border)",
          }}
          aria-describedby={promptError ? "prompt-error" : undefined}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
          {promptError
            ? <span id="prompt-error" style={errorTextStyle}>{promptError}</span>
            : <span />
          }
          <span style={{ fontSize: "10px", color: charCount > 3800 ? "#e07050" : "var(--color-text-muted)" }}>
            {charCount}/4000
          </span>
        </div>
      </div>

      {/* Creature selector */}
      <div style={fieldStyle}>
        <label htmlFor="task-creature" style={labelStyle}>Creature</label>
        <div style={{ display: "flex", gap: "6px" }}>
          {CREATURE_OPTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCreature(c.id)}
              style={{
                ...creatureBtnStyle,
                background: creature === c.id ? "rgba(198,139,60,0.18)" : "transparent",
                border: `1px solid ${creature === c.id ? "var(--color-border-hover)" : "var(--color-border)"}`,
                color: creature === c.id ? "var(--color-amber)" : "var(--color-text-muted)",
              }}
              title={c.label}
              aria-pressed={creature === c.id}
            >
              <span style={{ fontSize: "16px" }}>{c.icon}</span>
              <span style={{ fontSize: "10px", marginTop: "2px" }}>{c.label.split(" ")[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Provider selector */}
      <div style={fieldStyle}>
        <label htmlFor="task-provider" style={labelStyle}>Provider</label>
        <select
          id="task-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
          style={selectStyle}
        >
          {PROVIDER_OPTIONS.map((p) => {
            const avail = providers[p.id]?.available;
            return (
              <option key={p.id} value={p.id}>
                {avail ? "✓" : "○"} {p.label}
              </option>
            );
          })}
        </select>
        {!providerAvailable && (
          <p style={{ fontSize: "10px", color: "#e07050", margin: "3px 0 0" }}>
            {providers[provider]?.unavailableReason ?? "Provider unavailable — configure in Settings"}
          </p>
        )}
      </div>

      {/* Model selector */}
      <div style={fieldStyle}>
        <label htmlFor="task-model" style={labelStyle}>Model</label>
        {models.length > 0 ? (
          <select
            id="task-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={selectStyle}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        ) : (
          <input
            id="task-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. openai/gpt-4o-mini"
            style={inputStyle}
            aria-label="Model ID"
          />
        )}
      </div>

      {error && <p style={errorTextStyle}>{error}</p>}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
        {onClose && (
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || prompt.length < 10}
          style={{
            ...primaryBtnStyle,
            opacity: submitting || prompt.length < 10 ? 0.45 : 1,
          }}
          aria-busy={submitting}
        >
          {submitting ? "Submitting…" : "Submit Task"}
        </button>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const formStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "12px",
};
const titleStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 700, color: "var(--color-amber)",
  letterSpacing: "0.04em",
};
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "4px" };
const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)", padding: "7px 10px", fontSize: "12px",
  color: "var(--color-text-primary)", outline: "none", fontFamily: "inherit",
  width: "100%",
};
const selectStyle: React.CSSProperties = { ...inputStyle };
const creatureBtnStyle: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  padding: "8px 4px", borderRadius: "var(--radius-md)", cursor: "pointer",
  transition: "all var(--transition-fast)",
};
const errorTextStyle: React.CSSProperties = { fontSize: "11px", color: "#cf7f7f", margin: 0 };
const primaryBtnStyle: React.CSSProperties = {
  background: "var(--color-amber)", color: "#1a0f00",
  border: "none", borderRadius: "var(--radius-sm)", padding: "7px 18px",
  fontSize: "12px", fontWeight: 700, cursor: "pointer",
};
const secondaryBtnStyle: React.CSSProperties = {
  background: "transparent", color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
  padding: "7px 14px", fontSize: "12px", cursor: "pointer",
};
