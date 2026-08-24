import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED = [
  "supabase-migration-game-integrity.sql",
  "supabase-migration-zadachi.sql",
  "supabase-migration-tournaments-arena.sql",
  "supabase-migration-live-protocol-phase-f.sql",
  "supabase-migration-trust-phase-g.sql",
];

describe("SQL migrations", () => {
  it("keeps required migration files in the repo root", () => {
    const root = process.cwd();
    const sql = readdirSync(root).filter((f) => f.endsWith(".sql"));
    for (const name of REQUIRED) {
      expect(sql, name).toContain(name);
      expect(existsSync(join(root, name))).toBe(true);
    }
  });
});
