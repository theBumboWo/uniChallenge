/**
 * whimsical-village-dev MCP Server
 * Req 21 — Kiro University Challenge Lesson 6: MCP Integration
 *
 * Exposes three development tools to Kiro agent sessions:
 *   list_creatures()         — current creature config from dev SQLite DB
 *   list_tasks(status?)      — query tasks, optionally filtered by status
 *   validate_adapter(name)   — run adapter interface validation script
 *
 * Run: node tools/mcp-server/index.js
 * Config: .kiro/mcp.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Resolve project root relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// ─── SQLite helper ─────────────────────────────────────────────────────────────
// Uses better-sqlite3 for synchronous reads from the dev database.
// The dev database is a copy of the production DB — never the live app DB.
function openDb() {
  // Dynamic import to avoid startup error if better-sqlite3 not yet installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const dbPath = path.join(
    process.env.APPDATA ?? path.join(process.env.HOME ?? "~", ".config"),
    "WhimsicalAgentVillage",
    "whimsical-agent-village.db"
  );
  try {
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

// ─── Tool implementations ──────────────────────────────────────────────────────

function listCreatures(): object {
  const db = openDb();
  if (!db) {
    return { error: "Database not found — has the app been launched at least once?", creatures: [] };
  }
  try {
    const rows = db.prepare("SELECT * FROM creatures").all();
    return { creatures: rows };
  } finally {
    db.close();
  }
}

function listTasks(status?: string): object {
  const db = openDb();
  if (!db) {
    return { error: "Database not found — has the app been launched at least once?", tasks: [] };
  }
  try {
    const rows = status
      ? db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT 50").all(status)
      : db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50").all();
    return { tasks: rows, count: rows.length };
  } finally {
    db.close();
  }
}

function validateAdapter(adapterName: string): object {
  const adapterPath = path.join(PROJECT_ROOT, "src", "adapters", `${adapterName}.ts`);

  // Check file exists
  try {
    const fs = require("fs");
    if (!fs.existsSync(adapterPath)) {
      return {
        adapter: adapterName,
        valid: false,
        missingMethods: [],
        errors: [`File not found: src/adapters/${adapterName}.ts`],
      };
    }

    const src: string = fs.readFileSync(adapterPath, "utf8");

    const REQUIRED_METHODS = [
      "discover",
      "authenticate",
      "listModels",
      "startSession",
      "streamEvents",
      "sendApproval",
      "cancelSession",
    ];

    const missingMethods = REQUIRED_METHODS.filter((m) => !src.includes(m));

    // Additional checks
    const errors: string[] = [];
    if (src.includes("console.log") && src.toLowerCase().includes("credential")) {
      errors.push("Potential credential logging detected — review console.log calls near credential handling");
    }
    if (src.includes("process.env") && src.includes("API_KEY")) {
      errors.push("Adapter appears to read credentials from env vars — credentials must come from credentialService");
    }

    return {
      adapter: adapterName,
      valid: missingMethods.length === 0 && errors.length === 0,
      missingMethods,
      errors,
    };
  } catch (e) {
    return {
      adapter: adapterName,
      valid: false,
      missingMethods: [],
      errors: [`Validation error: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

// ─── MCP Server setup ──────────────────────────────────────────────────────────

const server = new Server(
  { name: "whimsical-village-dev", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_creatures",
      description: "Returns the current creature configuration from the dev database",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_tasks",
      description: "Queries tasks from the dev database, optionally filtered by status",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Optional task status filter: Queued | Assigned | Running | Waiting_For_Approval | Completed | Failed | Cancelled",
          },
        },
        required: [],
      },
    },
    {
      name: "validate_adapter",
      description: "Checks that a provider adapter file exports all required ProviderAdapter interface methods",
      inputSchema: {
        type: "object",
        properties: {
          adapter_name: {
            type: "string",
            description: "Adapter file name without extension, e.g. OpenRouterAdapter",
          },
        },
        required: ["adapter_name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_creatures":
      return { content: [{ type: "text", text: JSON.stringify(listCreatures(), null, 2) }] };

    case "list_tasks": {
      const status = (args as Record<string, string>)?.status;
      return { content: [{ type: "text", text: JSON.stringify(listTasks(status), null, 2) }] };
    }

    case "validate_adapter": {
      const adapterName = (args as Record<string, string>)?.adapter_name;
      if (!adapterName) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "adapter_name is required" }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(validateAdapter(adapterName), null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
