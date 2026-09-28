/**
 * Persistence Service — wraps tauri-plugin-sql for all SQLite operations.
 * Req 14 (Persistence Layer).
 *
 * Uses tauri-plugin-sql's Database class directly on the JS side.
 * WAL mode is configured in tauri.conf.json (preloadConnections).
 * Credentials are NEVER stored here — they live in Windows Credential Manager.
 */

import Database from "@tauri-apps/plugin-sql";
import type {
  Task,
  Creature,
  CreatureId,
  ProviderId,
  UserPreferences,
  Pipeline,
} from "../store/appStore";

const DB_URL = "sqlite:whimsical-agent-village.db";

let _db: Awaited<ReturnType<typeof Database.load>> | null = null;

async function getDb() {
  if (!_db) {
    _db = await Database.load(DB_URL);
  }
  return _db;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskFilter {
  status?: Task["status"];
  creatureId?: CreatureId;
  limit?: number;
}

/** Persist a new task (Req 6.3 — within 500 ms). */
export async function saveTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO tasks
       (id, title, prompt, status, creature_id, provider_id, model_id,
        pipeline_id, pipeline_step, created_at, assigned_at, started_at,
        completed_at, execution_output, error_details,
        input_token_count, output_token_count, total_token_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      task.id, task.title, task.prompt, task.status,
      task.creatureId, task.providerId, task.modelId,
      task.pipelineId, task.pipelineStep,
      task.createdAt, task.assignedAt, task.startedAt, task.completedAt,
      task.executionOutput, task.errorDetails,
      task.inputTokenCount, task.outputTokenCount, task.totalTokenCount,
    ]
  );
}

/** Patch specific fields on an existing task record. */
export async function updateTask(id: string, patch: Partial<Omit<Task, "id" | "approvalRequest">>): Promise<void> {
  const colMap: Record<string, string> = {
    title: "title", prompt: "prompt", status: "status",
    creatureId: "creature_id", providerId: "provider_id", modelId: "model_id",
    pipelineId: "pipeline_id", pipelineStep: "pipeline_step",
    createdAt: "created_at", assignedAt: "assigned_at",
    startedAt: "started_at", completedAt: "completed_at",
    executionOutput: "execution_output", errorDetails: "error_details",
    inputTokenCount: "input_token_count",
    outputTokenCount: "output_token_count",
    totalTokenCount: "total_token_count",
  };
  const entries = Object.entries(patch).filter(([k]) => colMap[k]);
  if (entries.length === 0) return;
  const db = await getDb();
  const setClauses = entries.map(([k], i) => `${colMap[k]} = $${i + 1}`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.execute(`UPDATE tasks SET ${setClauses} WHERE id = $${values.length + 1}`, [...values, id]);
}

/** Load tasks, optionally filtered. */
export async function getTasks(filter?: TaskFilter): Promise<Task[]> {
  const db = await getDb();
  let query = "SELECT * FROM tasks";
  const params: unknown[] = [];
  const conditions: string[] = [];
  let pi = 1;

  if (filter?.status) { conditions.push(`status = $${pi++}`); params.push(filter.status); }
  if (filter?.creatureId) { conditions.push(`creature_id = $${pi++}`); params.push(filter.creatureId); }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY created_at DESC";
  if (filter?.limit) query += ` LIMIT ${filter.limit}`;

  const rows = await db.select<Record<string, unknown>[]>(query, params);
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM tasks WHERE id = $1", [id]);
  return rows.length > 0 ? rowToTask(rows[0]) : null;
}

/** Detect orphaned tasks — set Running/Waiting_For_Approval to Failed (Req 6.16). */
export async function detectOrphanedTasks(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM tasks WHERE status IN ('Running', 'Waiting_For_Approval')"
  );
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.execute(
      `UPDATE tasks SET status = 'Failed',
         error_details = 'Application shutdown during execution',
         completed_at = $1
       WHERE status IN ('Running', 'Waiting_For_Approval')`,
      [Date.now()]
    );
  }
  return ids;
}

/** Clear tasks older than N days (Req 14.5). */
export async function clearHistoryOlderThan(days: number): Promise<void> {
  const db = await getDb();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  await db.execute(
    "DELETE FROM tasks WHERE created_at < $1 AND status IN ('Completed','Failed','Cancelled')",
    [cutoff]
  );
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row["id"] as string,
    title: row["title"] as string,
    prompt: row["prompt"] as string,
    status: row["status"] as Task["status"],
    creatureId: row["creature_id"] as CreatureId,
    providerId: row["provider_id"] as ProviderId,
    modelId: (row["model_id"] as string) ?? "",
    pipelineId: (row["pipeline_id"] as string) ?? null,
    pipelineStep: (row["pipeline_step"] as number) ?? null,
    createdAt: row["created_at"] as number,
    assignedAt: (row["assigned_at"] as number) ?? null,
    startedAt: (row["started_at"] as number) ?? null,
    completedAt: (row["completed_at"] as number) ?? null,
    executionOutput: (row["execution_output"] as string) ?? "",
    errorDetails: (row["error_details"] as string) ?? null,
    inputTokenCount: (row["input_token_count"] as number) ?? null,
    outputTokenCount: (row["output_token_count"] as number) ?? null,
    totalTokenCount: (row["total_token_count"] as number) ?? null,
    approvalRequest: null,
  };
}

// ─── Creatures ────────────────────────────────────────────────────────────────

export async function saveCreature(
  creature: Pick<Creature, "id" | "name" | "defaultProviderId" | "defaultModelId" | "position">
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE creatures SET name=$1, default_provider_id=$2, default_model_id=$3,
       position_x=$4, position_y=$5 WHERE id=$6`,
    [creature.name, creature.defaultProviderId, creature.defaultModelId,
      creature.position.x, creature.position.y, creature.id]
  );
}

export async function getCreatures() {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>("SELECT * FROM creatures");
  return rows.map((r) => ({
    id: r["id"] as CreatureId,
    name: r["name"] as string,
    defaultProviderId: (r["default_provider_id"] as ProviderId) ?? "openrouter",
    defaultModelId: (r["default_model_id"] as string) ?? "",
    positionX: (r["position_x"] as number) ?? 20,
    positionY: (r["position_y"] as number) ?? 30,
  }));
}

// ─── Provider Settings ────────────────────────────────────────────────────────

export async function saveProviderSettings(
  providerId: ProviderId,
  patch: {
    isAvailable?: boolean;
    unavailableReason?: string | null;
    version?: string | null;
    modelCacheJson?: string;
  }
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let pi = 1;
  if (patch.isAvailable !== undefined) { fields.push(`is_available=$${pi++}`); values.push(patch.isAvailable ? 1 : 0); }
  if (patch.unavailableReason !== undefined) { fields.push(`unavailable_reason=$${pi++}`); values.push(patch.unavailableReason); }
  if (patch.version !== undefined) { fields.push(`version=$${pi++}`); values.push(patch.version); }
  if (patch.modelCacheJson !== undefined) { fields.push(`model_cache_json=$${pi++}`); values.push(patch.modelCacheJson); }
  fields.push(`last_discovered_at=$${pi++}`); values.push(Date.now());
  if (fields.length === 0) return;
  await db.execute(
    `UPDATE provider_settings SET ${fields.join(", ")} WHERE provider_id=$${pi}`,
    [...values, providerId]
  );
}

// ─── User Preferences ────────────────────────────────────────────────────────

export async function savePreference(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO user_preferences (key, value) VALUES ($1, $2)",
    [key, value]
  );
}

export async function getPreference(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM user_preferences WHERE key = $1",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function getAllPreferences(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM user_preferences"
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveAllPreferences(prefs: UserPreferences): Promise<void> {
  for (const [key, value] of Object.entries(prefs)) {
    await savePreference(key, String(value));
  }
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

export async function savePipeline(pipeline: Pipeline): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR REPLACE INTO pipelines (id, name, steps_json, created_at) VALUES ($1,$2,$3,$4)",
    [pipeline.id, pipeline.name, JSON.stringify(pipeline.steps), pipeline.createdAt]
  );
}
