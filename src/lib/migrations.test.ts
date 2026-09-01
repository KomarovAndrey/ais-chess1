import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED = [
  "supabase-migration-game-integrity.sql",
  "supabase-migration-live-protocol-phase-f.sql",
  "supabase-migration-trust-phase-g.sql",
  "supabase-migration-lichess-clock-start.sql",
  "supabase-migration-wave-3-live-lobby.sql",
];

describe("SQL migrations", () => {
  it("keeps required migration and seed files in the repo", () => {
    const root = process.cwd();
    const sql = new Set(readdirSync(root).filter((f) => f.endsWith(".sql")));
    for (const name of REQUIRED) {
      expect(existsSync(join(root, name)), name).toBe(true);
      if (name.endsWith(".sql") && !name.includes("/")) {
        expect(sql.has(name), name).toBe(true);
      }
    }
  });
});
