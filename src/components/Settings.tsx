/**
 * Settings panel — Req 17 (Settings and Configuration)
 * Sections: Providers (credential entry, masked display, Test Connection),
 *           Appearance (always-on-top, compact mode start, reduced motion).
 * Req 13 (security): masked inputs, confirmation modal before save.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import type { ProviderId } from "../store/appStore";
import { saveCredential, hasCredential, getMaskedDisplay, getCredentialLabel } from "../services/credentialService";
import { applyPreference } from "../services/SettingsService";
import { invoke } from "@tauri-apps/api/core";

type SettingsSection = "providers" | "appearance" | "audio" | "workspace";

const PROVIDER_IDS: ProviderId[] = ["openrouter", "openai_codex", "claude_code", "opencode", "kiro_cli"];

// ── Credential confirmation modal ─────────────────────────────────────────────

interface ConfirmModalProps {
  providerName: string;
  credentialType: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ providerName, credentialType, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--color-bg-panel)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          width: "320px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: "14px", color: "var(--color-text-primary)" }}>
          Save credential?
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Save <strong>{credentialType}</strong> for <strong>{providerName}</strong> to the OS keychain?
          The value is not shown here for security.
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={onConfirm} style={primaryBtnStyle}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Provider row ──────────────────────────────────────────────────────────────

function ProviderRow({ providerId }: { providerId: ProviderId }) {
  const providerInfo = useAppStore((s) => s.providers[providerId]);
  const { providerName, credentialType } = getCredentialLabel(providerId);

  const [inputValue, setInputValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [maskedDisplay, setMaskedDisplay] = useState("●●●●●●●●");
  const [hasKey, setHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load masked display on mount
  useEffect(() => {
    hasCredential(providerId).then(setHasKey);
    getMaskedDisplay(providerId, false).then(setMaskedDisplay);
  }, [providerId]);

  const handleShowToggle = useCallback(async () => {
    const next = !showValue;
    setShowValue(next);
    const display = await getMaskedDisplay(providerId, next);
    setMaskedDisplay(display);
  }, [providerId, showValue]);

  // Req 13.7: show confirmation modal before saving
  const handleSaveClick = useCallback(() => {
    if (!inputValue.trim()) return;
    setPendingConfirm(true);
  }, [inputValue]);

  const handleConfirmSave = useCallback(async () => {
    setPendingConfirm(false);
    setSaveError(null);
    try {
      await saveCredential(providerId, inputValue.trim());
      setInputValue("");
      setHasKey(true);
      const display = await getMaskedDisplay(providerId, false);
      setMaskedDisplay(display);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }, [providerId, inputValue]);

  const handleCancelConfirm = useCallback(() => {
    setPendingConfirm(false);
    setInputValue(""); // Req 13.7: discard value on cancel
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{ found: boolean }>("check_binary", { name: providerId === "openrouter" ? "curl" : providerId.replace("_", "-") });
      // For OpenRouter, just check if a key exists; for others check binary
      if (providerId === "openrouter") {
        const ok = await hasCredential("openrouter");
        setTestResult(ok ? "ok" : "fail");
      } else {
        setTestResult(result.found ? "ok" : "fail");
      }
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  }, [providerId]);

  return (
    <>
      {pendingConfirm && (
        <ConfirmModal
          providerName={providerName}
          credentialType={credentialType}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelConfirm}
        />
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {providerName}
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "99px",
              background: providerInfo.available ? "rgba(80,200,100,0.15)" : "rgba(200,80,80,0.12)",
              color: providerInfo.available ? "#5fcf7f" : "#cf7f7f",
              border: `1px solid ${providerInfo.available ? "rgba(80,200,100,0.3)" : "rgba(200,80,80,0.2)"}`,
            }}
          >
            {providerInfo.available ? "Available" : providerInfo.unavailableReason ?? "Unavailable"}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleTestConnection}
            disabled={testing}
            style={{ ...secondaryBtnStyle, fontSize: "10px", padding: "3px 8px" }}
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          {testResult && (
            <span style={{ fontSize: "11px", color: testResult === "ok" ? "#5fcf7f" : "#cf7f7f" }}>
              {testResult === "ok" ? "✓" : "✗"}
            </span>
          )}
        </div>

        {/* Masked display of stored key */}
        {hasKey && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={maskedInputStyle}>{maskedDisplay}</span>
            <button onClick={handleShowToggle} style={iconBtnStyle} title="Toggle visibility" aria-label="Toggle credential visibility">
              {showValue ? "🙈" : "👁"}
            </button>
          </div>
        )}

        {/* New credential input — Req 13.4: type=password, default hidden */}
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="password"
            placeholder={hasKey ? `Update ${credentialType}…` : `Enter ${credentialType}…`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveClick(); }}
            style={inputStyle}
            autoComplete="off"
            aria-label={`${providerName} ${credentialType}`}
          />
          <button
            onClick={handleSaveClick}
            disabled={!inputValue.trim()}
            style={{ ...primaryBtnStyle, opacity: inputValue.trim() ? 1 : 0.45 }}
          >
            Save
          </button>
        </div>
        {saveError && (
          <p style={{ fontSize: "11px", color: "#cf7f7f", marginTop: "4px" }}>{saveError}</p>
        )}
      </div>
    </>
  );
}

// ── Main Settings component ───────────────────────────────────────────────────

export default function Settings() {
  const [section, setSection] = useState<SettingsSection>("providers");
  const prefs = useAppStore((s) => s.preferences);

  const handleToggle = useCallback(
    async (key: "alwaysOnTop" | "startInCompactMode" | "reducedMotion") => {
      await applyPreference(key, !prefs[key]);
    },
    [prefs]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Section tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["providers", "appearance", "audio", "workspace"] as SettingsSection[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            style={{
              ...tabPillStyle,
              background: section === s ? "rgba(198,139,60,0.18)" : "transparent",
              color: section === s ? "var(--color-amber)" : "var(--color-text-muted)",
              border: `1px solid ${section === s ? "var(--color-border-hover)" : "var(--color-border)"}`,
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Providers section (Req 17.2) */}
      {section === "providers" && (
        <div>
          <p style={sectionHintStyle}>
            Credentials are stored in the OS keychain. They are never written to disk or logs.
          </p>
          {PROVIDER_IDS.map((id) => (
            <ProviderRow key={id} providerId={id} />
          ))}
        </div>
      )}

      {/* Appearance section (Req 17.5) */}
      {section === "appearance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <ToggleRow
            label="Always on top"
            description="Keep the window above other applications"
            checked={prefs.alwaysOnTop}
            onChange={() => handleToggle("alwaysOnTop")}
          />
          <ToggleRow
            label="Start in compact mode"
            description="Launch as the pill rather than the full workspace"
            checked={prefs.startInCompactMode}
            onChange={() => handleToggle("startInCompactMode")}
          />
          <ToggleRow
            label="Reduced motion"
            description="Disable particle effects and limit animations to key frames"
            checked={prefs.reducedMotion}
            onChange={() => handleToggle("reducedMotion")}
          />
        </div>
      )}

      {/* Audio stub (Phase 5) */}
      {section === "audio" && (
        <p style={sectionHintStyle}>Audio settings — Phase 5 (Req 16)</p>
      )}

      {/* Workspace stub */}
      {section === "workspace" && (
        <p style={sectionHintStyle}>Workspace paths — Phase 4 (Req 17.4)</p>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-overlay)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</div>
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>{description}</div>
      </div>
      {/* Toggle switch */}
      <div
        onClick={onChange}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(); }}
        style={{
          width: "36px",
          height: "20px",
          borderRadius: "10px",
          background: checked ? "var(--color-amber)" : "rgba(255,255,255,0.12)",
          position: "relative",
          transition: "background var(--transition-base)",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: checked ? "19px" : "3px",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "white",
            transition: "left var(--transition-base)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </label>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--color-amber)",
  color: "#1a0f00",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity var(--transition-fast)",
};

const secondaryBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 14px",
  fontSize: "12px",
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  padding: "2px",
};

const maskedInputStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text-muted)",
  letterSpacing: "0.1em",
  fontFamily: "monospace",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 10px",
  fontSize: "12px",
  color: "var(--color-text-primary)",
  outline: "none",
};

const tabPillStyle: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: "99px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all var(--transition-fast)",
  letterSpacing: "0.04em",
};

const sectionHintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text-muted)",
  fontStyle: "italic",
  marginBottom: "16px",
  lineHeight: 1.5,
};
