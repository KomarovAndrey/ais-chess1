/* Copy Stockfish lite single-thread engine into public/ for browser Workers. */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "stockfish", "bin");
const dest = path.join(__dirname, "..", "public", "engines");

const files = [
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

if (!fs.existsSync(path.join(src, files[0]))) {
  console.warn("copy-stockfish: stockfish package not found, skip");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log("copy-stockfish: engines ready in public/engines");
