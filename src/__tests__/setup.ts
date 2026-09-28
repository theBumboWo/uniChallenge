/**
 * Vitest global setup — runs before every test file.
 */

// Mock the Tauri API so unit/PBT tests can run outside Tauri WebView.
// Real IPC calls are tested via integration tests in Phase 3+.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
