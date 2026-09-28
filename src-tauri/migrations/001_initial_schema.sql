-- Whimsical Agent Village — Initial Database Schema
-- Migration: 001_initial_schema
-- Req 14 (Persistence Layer)
--
-- SECURITY: Credentials are NEVER stored here.
-- They live exclusively in Windows Credential Manager (Req 13.1).
--
-- WAL mode is set at connection time by tauri-plugin-sql configuration.

-- ─── Tasks ────────────────────────────────────────────────────────────────────
-- Stores every task submitted by the user (Req 14.2, Req 6.9, Req 6.10).
CREATE TABLE IF NOT EXISTS tasks (
    id                  TEXT PRIMARY KEY NOT NULL,          -- UUID v4
    title               TEXT NOT NULL,                      -- First 60 chars of prompt
    prompt              TEXT NOT NULL,                      -- 10–4000 chars
    status              TEXT NOT NULL DEFAULT 'Queued',     -- TaskStatus enum
    creature_id         TEXT NOT NULL,                      -- CreatureId enum
    provider_id         TEXT NOT NULL,                      -- ProviderId enum
    model_id            TEXT NOT NULL DEFAULT '',
    pipeline_id         TEXT,                               -- NULL if standalone task
    pipeline_step       INTEGER,                            -- 0-based index, NULL if standalone
    created_at          INTEGER NOT NULL,                   -- Unix ms
    assigned_at         INTEGER,
    started_at          INTEGER,
    completed_at        INTEGER,
    execution_output    TEXT NOT NULL DEFAULT '',           -- Accumulated token text
    error_details       TEXT,
    input_token_count   INTEGER,
    output_token_count  INTEGER,
    total_token_count   INTEGER
    -- NOTE: approval_request is ephemeral UI state, not persisted here
);

CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_creature_id   ON tasks (creature_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at    ON tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_pipeline_id   ON tasks (pipeline_id) WHERE pipeline_id IS NOT NULL;

-- ─── Creatures ────────────────────────────────────────────────────────────────
-- Stores persistent creature configuration and last known world position (Req 14.2, Req 14.7).
CREATE TABLE IF NOT EXISTS creatures (
    id                    TEXT PRIMARY KEY NOT NULL,   -- CreatureId: builder | researcher | debugger
    name                  TEXT NOT NULL,               -- 1–32 chars, user-configurable (Req 4.13)
    default_provider_id   TEXT NOT NULL DEFAULT 'openrouter',
    default_model_id      TEXT NOT NULL DEFAULT '',
    position_x            INTEGER NOT NULL DEFAULT 20, -- Last known tile X
    position_y            INTEGER NOT NULL DEFAULT 30  -- Last known tile Y
);

-- Seed default creatures on first launch
INSERT OR IGNORE INTO creatures (id, name, position_x, position_y) VALUES
    ('builder',    'The Builder',    20, 30),
    ('researcher', 'The Researcher', 50, 30),
    ('debugger',   'The Debugger',   35, 38);

-- ─── Provider Settings ────────────────────────────────────────────────────────
-- Caches provider availability and model lists (non-secret) (Req 14.2).
-- Credentials are NEVER stored here — they live in Windows Credential Manager.
CREATE TABLE IF NOT EXISTS provider_settings (
    provider_id           TEXT PRIMARY KEY NOT NULL,   -- ProviderId enum
    is_available          INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    last_discovered_at    INTEGER,                     -- Unix ms of last discover() call
    unavailable_reason    TEXT,                        -- Human-readable reason if unavailable
    version               TEXT,                        -- CLI/SDK version string
    model_cache_json      TEXT NOT NULL DEFAULT '[]'   -- JSON array of ModelInfo
);

-- Seed provider rows
INSERT OR IGNORE INTO provider_settings (provider_id) VALUES
    ('openai_codex'),
    ('claude_code'),
    ('opencode'),
    ('kiro_cli'),
    ('openrouter');

-- ─── User Preferences ────────────────────────────────────────────────────────
-- Key/value store for all user preferences (Req 14.2, Req 17).
CREATE TABLE IF NOT EXISTS user_preferences (
    key     TEXT PRIMARY KEY NOT NULL,
    value   TEXT NOT NULL
);

-- Seed defaults (matching DEFAULT_PREFERENCES in appStore.ts)
INSERT OR IGNORE INTO user_preferences (key, value) VALUES
    ('alwaysOnTop',               'false'),
    ('startInCompactMode',        'false'),
    ('reducedMotion',             'false'),
    ('closeToTray',               'true'),
    ('desktopNotificationsEnabled', 'false'),
    ('audioEnabled',              'false'),
    ('audioVolumeAmbient',        '0.4'),
    ('audioVolumeCreature',       '0.6'),
    ('audioVolumeEvent',          '0.8'),
    ('historyRetentionDays',      '90'),
    ('defaultWorkspacePath',      '');

-- ─── Pipelines ───────────────────────────────────────────────────────────────
-- Stores user-defined multi-step pipelines (Req 15).
CREATE TABLE IF NOT EXISTS pipelines (
    id          TEXT PRIMARY KEY NOT NULL,   -- UUID v4
    name        TEXT NOT NULL,
    steps_json  TEXT NOT NULL DEFAULT '[]',  -- JSON array of PipelineStep
    created_at  INTEGER NOT NULL
);
