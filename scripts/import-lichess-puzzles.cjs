#!/usr/bin/env node
/**
 * Stream-import quality puzzles from the Lichess open puzzle database.
 *
 * Lichess CSV: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,...
 * FEN is BEFORE the opponent's setup move. Moves[0] is that setup move;
 * Moves[1..] is the player-to-move solution line (our format).
 *
 * Usage:
 *   curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst \
 *     | zstd -d -c \
 *     | node scripts/import-lichess-puzzles.mjs
 *
 * Or with a local decompressed CSV:
 *   node scripts/import-lichess-puzzles.mjs --file /path/to/lichess_db_puzzle.csv
 *
 * Options:
 *   --target 12000   how many puzzles to keep (default 12000)
 *   --min-pop 85
 *   --min-plays 800
 *   --max-rd 110
 *   --min-rating 600
 *   --max-rating 2400
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Chess } = require("chess.js");

const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "zadachi-lichess.json");
const OUT_SQL = path.join(ROOT, "supabase-seed-zadachi-lichess.sql");

function parseArgs(argv) {
  const opts = {
    target: 12000,
    minPop: 85,
    minPlays: 800,
    maxRd: 110,
    minRating: 600,
    maxRating: 2400,
    file: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") opts.file = argv[++i];
    else if (a === "--target") opts.target = Number(argv[++i]);
    else if (a === "--min-pop") opts.minPop = Number(argv[++i]);
    else if (a === "--min-plays") opts.minPlays = Number(argv[++i]);
    else if (a === "--max-rd") opts.maxRd = Number(argv[++i]);
    else if (a === "--min-rating") opts.minRating = Number(argv[++i]);
    else if (a === "--max-rating") opts.maxRating = Number(argv[++i]);
  }
  return opts;
}

/** Minimal CSV split that handles quoted fields. */
function splitCsv(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Convert Lichess row → our Zadacha shape, or null if invalid.
 * Trusts Lichess "only move" uniqueness; we verify the UCI line is legal.
 */
function convertRow(cols) {
  const id = cols[0]?.trim();
  const fenBefore = cols[1]?.trim();
  const movesRaw = cols[2]?.trim();
  const rating = Number(cols[3]);
  const rd = Number(cols[4]);
  const popularity = Number(cols[5]);
  const nbPlays = Number(cols[6]);
  const themesRaw = cols[7]?.trim() || "";

  if (!id || !fenBefore || !movesRaw) return null;
  if (!Number.isFinite(rating) || !Number.isFinite(popularity) || !Number.isFinite(nbPlays)) {
    return null;
  }

  const allMoves = movesRaw.split(/\s+/).filter(Boolean);
  if (allMoves.length < 2) return null;

  let chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return null;
  }

  const setup = allMoves[0];
  try {
    const from = setup.slice(0, 2);
    const to = setup.slice(2, 4);
    const promotion = setup.length > 4 ? setup[4] : undefined;
    const played = chess.move({
      from,
      to,
      promotion: promotion,
    });
    if (!played) return null;
  } catch {
    return null;
  }

  const solution = allMoves.slice(1);
  for (const uci of solution) {
    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const played = chess.move({ from, to, promotion });
      if (!played) return null;
    } catch {
      return null;
    }
  }

  const themes = themesRaw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    id: `lichess-${id}`,
    fen: (() => {
      // Recompute player-to-move FEN (after setup move only).
      const c = new Chess(fenBefore);
      const from = setup.slice(0, 2);
      const to = setup.slice(2, 4);
      const promotion = setup.length > 4 ? setup[4] : undefined;
      c.move({ from, to, promotion });
      return c.fen();
    })(),
    moves: solution,
    themes,
    rating: Math.round(rating),
    popularity: Math.round(popularity),
    nbPlays: Math.round(nbPlays),
    ratingDeviation: Number.isFinite(rd) ? Math.round(rd) : null,
  };
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function themesSql(arr) {
  return `ARRAY[${arr.map((t) => `'${sqlEscape(t)}'`).join(",")}]::text[]`;
}

function movesSql(arr) {
  return `ARRAY[${arr.map((m) => `'${sqlEscape(m)}'`).join(",")}]::text[]`;
}

function writeOutputs(puzzles) {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  const slim = puzzles.map((p) => ({
    id: p.id,
    fen: p.fen,
    moves: p.moves,
    themes: p.themes,
    rating: p.rating,
    popularity: p.popularity,
  }));
  fs.writeFileSync(OUT_JSON, JSON.stringify(slim));

  const lines = [];
  lines.push("-- Lichess puzzle seed (Wave 2). Run in Supabase SQL editor.");
  lines.push("-- Generated by scripts/import-lichess-puzzles.mjs");
  lines.push("-- Upserts into public.puzzles; safe to re-run.");
  lines.push("");
  lines.push("begin;");
  lines.push("");

  const CHUNK = 200;
  for (let i = 0; i < puzzles.length; i += CHUNK) {
    const chunk = puzzles.slice(i, i + CHUNK);
    lines.push("insert into public.puzzles (id, fen, moves, themes, rating, popularity) values");
    const values = chunk.map(
      (p) =>
        `  ('${sqlEscape(p.id)}', '${sqlEscape(p.fen)}', ${movesSql(p.moves)}, ${themesSql(p.themes)}, ${p.rating}, ${p.popularity})`
    );
    lines.push(values.join(",\n"));
    lines.push(`on conflict (id) do update set
  fen = excluded.fen,
  moves = excluded.moves,
  themes = excluded.themes,
  rating = excluded.rating,
  popularity = excluded.popularity;`);
    lines.push("");
  }

  lines.push("commit;");
  lines.push("");
  lines.push(`-- Imported ${puzzles.length} puzzles.`);
  fs.writeFileSync(OUT_SQL, lines.join("\n"));

  console.log(`Wrote ${slim.length} puzzles →`);
  console.log(`  ${path.relative(ROOT, OUT_JSON)} (${fs.statSync(OUT_JSON).size} bytes)`);
  console.log(`  ${path.relative(ROOT, OUT_SQL)} (${fs.statSync(OUT_SQL).size} bytes)`);
}

async function main() {
  const opts = parseArgs(process.argv);
  const input = opts.file ? fs.createReadStream(opts.file) : process.stdin;
  if (process.stdin.isTTY && !opts.file) {
    console.error(
      "Pipe CSV on stdin or pass --file path/to/lichess_db_puzzle.csv"
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const kept = [];
  // Spread across rating bands so the catalog is not all ~1500.
  const bands = [
    { min: 600, max: 999, quota: Math.floor(opts.target * 0.2) },
    { min: 1000, max: 1399, quota: Math.floor(opts.target * 0.25) },
    { min: 1400, max: 1799, quota: Math.floor(opts.target * 0.3) },
    { min: 1800, max: 2400, quota: Math.ceil(opts.target * 0.25) },
  ];
  const bandCounts = bands.map(() => 0);

  let lineNo = 0;
  let skipped = 0;
  let headerSkipped = false;

  for await (const line of rl) {
    lineNo++;
    if (!headerSkipped) {
      headerSkipped = true;
      if (line.startsWith("PuzzleId") || line.startsWith("PuzzleId,")) continue;
    }
    if (!line.trim()) continue;

    const cols = splitCsv(line);
    const pop = Number(cols[5]);
    const plays = Number(cols[6]);
    const rating = Number(cols[3]);
    const rd = Number(cols[4]);

    if (pop < opts.minPop || plays < opts.minPlays) {
      skipped++;
      continue;
    }
    if (rd > opts.maxRd) {
      skipped++;
      continue;
    }
    if (rating < opts.minRating || rating > opts.maxRating) {
      skipped++;
      continue;
    }

    const bandIdx = bands.findIndex((b) => rating >= b.min && rating <= b.max);
    if (bandIdx < 0 || bandCounts[bandIdx] >= bands[bandIdx].quota) {
      // Soft-fill: if this band is full, skip unless we're still under total and
      // other bands may finish later — just skip for spread.
      if (kept.length >= opts.target) break;
      skipped++;
      continue;
    }

    const puzzle = convertRow(cols);
    if (!puzzle) {
      skipped++;
      continue;
    }

    kept.push(puzzle);
    bandCounts[bandIdx]++;

    if (kept.length % 1000 === 0) {
      console.error(
        `… ${kept.length}/${opts.target} kept (line ${lineNo}, skipped ${skipped}) ` +
          `bands=${bandCounts.join("/")}`
      );
    }
    if (kept.length >= opts.target) break;
  }

  // If some bands underfilled, do a second pass is hard with a stream.
  // Top up from whatever we have if slightly under target due to band caps.
  console.error(
    `Done scanning: kept ${kept.length}, skipped ${skipped}, lines ${lineNo}`
  );
  console.error(`Band fill: ${bands.map((b, i) => `${b.min}-${b.max}:${bandCounts[i]}/${b.quota}`).join(", ")}`);

  if (kept.length < Math.min(1000, opts.target)) {
    console.error("Too few puzzles collected — relax filters or check the CSV.");
    process.exit(2);
  }

  writeOutputs(kept);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
