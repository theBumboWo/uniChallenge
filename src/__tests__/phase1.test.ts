/**
 * Phase 1 smoke tests — App shell, services, and component contracts.
 * Req 1, 2, 13, 14, 17.
 */
import { describe, it, beforeEach } from "vitest";
import { useAppStore, DEFAULT_PREFERENCES } from "../store/appStore";

// Services are tested with mocked Tauri IPC (see setup.ts)
import * as credentialService from "../services/credentialService";

describe("credentialService — label mapping (Req 13)", () => {
  it("returns correct label for openrouter", () => {
    const label = credentialService.getCredentialLabel("openrouter");
    expect(label.providerName).toBe("OpenRouter");
    expect(label.credentialType).toBe("API Key");
  });

  it("returns correct label for kiro_cli (session token)", () => {
    const label = credentialService.getCredentialLabel("kiro_cli");
    expect(label.credentialType).toBe("Session Token");
  });

  it("getMaskedDisplay returns all dots when showToggle=false (Req 13.2)", async () => {
    // invoke mock returns null (no credential stored)
    const display = await credentialService.getMaskedDisplay("openrouter", false);
    expect(display).toBe("●●●●●●●●");
  });

  it("getMaskedDisplay returns all dots when credential is null and showToggle=true", async () => {
    const display = await credentialService.getMaskedDisplay("openrouter", true);
    expect(display).toBe("●●●●●●●●");
  });
});

describe("SettingsService — preference loading (Req 17)", () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.getState().actions.updatePreferences(DEFAULT_PREFERENCES);
  });

  it("DEFAULT_PREFERENCES has audioEnabled=false (Req 16.1)", () => {
    expect(DEFAULT_PREFERENCES.audioEnabled).toBe(false);
  });

  it("DEFAULT_PREFERENCES has closeToTray=true (Req 1.7)", () => {
    expect(DEFAULT_PREFERENCES.closeToTray).toBe(true);
  });

  it("DEFAULT_PREFERENCES has desktopNotificationsEnabled=false", () => {
    expect(DEFAULT_PREFERENCES.desktopNotificationsEnabled).toBe(false);
  });

  it("updatePreferences merges partial patches", () => {
    const { actions } = useAppStore.getState();
    actions.updatePreferences({ alwaysOnTop: true });
    expect(useAppStore.getState().preferences.alwaysOnTop).toBe(true);
    // Other prefs unchanged
    expect(useAppStore.getState().preferences.audioEnabled).toBe(false);
  });
});

describe("App store — display mode (Req 2)", () => {
  it("default display mode is full_workspace", () => {
    expect(useAppStore.getState().ui.displayMode).toBe("full_workspace");
  });

  it("setDisplayMode switches to compact", () => {
    useAppStore.getState().actions.setDisplayMode("compact");
    expect(useAppStore.getState().ui.displayMode).toBe("compact");
    // Reset
    useAppStore.getState().actions.setDisplayMode("full_workspace");
  });
});

describe("App store — provider discovery initialisation (Req 7.3)", () => {
  it("all 5 providers initialise as unavailable", () => {
    const { providers } = useAppStore.getState();
    expect(Object.keys(providers)).toHaveLength(5);
    Object.values(providers).forEach((p) => {
      expect(p.available).toBe(false);
    });
  });

  it("setProviderInfo marks a provider available", () => {
    const { actions } = useAppStore.getState();
    actions.setProviderInfo({
      providerId: "kiro_cli",
      available: true,
      unavailableReason: null,
      version: "kiro-cli-chat 2.24.1",
    });
    expect(useAppStore.getState().providers.kiro_cli.available).toBe(true);
    expect(useAppStore.getState().providers.kiro_cli.version).toBe("kiro-cli-chat 2.24.1");
    // Reset
    actions.setProviderInfo({ providerId: "kiro_cli", available: false, unavailableReason: null, version: null });
  });
});

describe("App store — window visibility (Req 1.3)", () => {
  it("setWindowVisible updates UI state", () => {
    const { actions } = useAppStore.getState();
    actions.setWindowVisible(false);
    expect(useAppStore.getState().ui.isWindowVisible).toBe(false);
    actions.setWindowVisible(true);
    expect(useAppStore.getState().ui.isWindowVisible).toBe(true);
  });
});

describe("useWindowVisibility hook contract (Req 1.3)", () => {
  it("hook module exports useWindowVisibility function", async () => {
    const mod = await import("../hooks/useWindowVisibility");
    expect(typeof mod.useWindowVisibility).toBe("function");
  });
});
