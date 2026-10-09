// Builds data/v2/kb.json: every chunk from data/chunks.jsonl plus its e5 embedding, in one file the
// app loads at once and searches in memory. Re-run whenever the source JSONs change (~5 min).
//   npm run build:kb
//
// Vectors are embedded from `embed_text` with the e5 "passage: " prefix, normalized, then stored as
// int8 (one global scale) in a single base64 string; row i belongs to chunks[i].
// The app must embed questions with the SAME GGUF and the "query: " prefix.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama } from 'node-llama-cpp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODEL_FILE = 'multilingual-e5-small-q8_0.gguf';
const MAX_TOKENS = 500; // e5-small's limit is 512, minus room for special tokens

const chunks = fs
  .readFileSync(path.join(root, 'data/chunks.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const destinations = JSON.parse(fs.readFileSync(path.join(root, 'data/destinations.json'), 'utf8'));

const llama = await getLlama();
const model = await llama.loadModel({ modelPath: path.join(root, 'models', MODEL_FILE) });
const ctx = await model.createEmbeddingContext({ contextSize: 512 });

const dims = model.embeddingVectorSize;
const floats = new Float32Array(chunks.length * dims);
let truncated = 0;
const t0 = Date.now();

for (let i = 0; i < chunks.length; i++) {
  let text = `passage: ${chunks[i].embed_text}`;
  const tokens = model.tokenize(text);
  if (tokens.length > MAX_TOKENS) {
    text = model.detokenize(tokens.slice(0, MAX_TOKENS));
    truncated++;
  }
  const v = (await ctx.getEmbeddingFor(text)).vector;
  const norm = Math.hypot(...v);
  for (let j = 0; j < dims; j++) floats[i * dims + j] = v[j] / norm;

  if (i % 1000 === 0 || i === chunks.length - 1) {
    const secs = (Date.now() - t0) / 1000;
    console.log(`${i + 1}/${chunks.length}  ${secs.toFixed(0)}s  (~${((secs / (i + 1)) * (chunks.length - i - 1)).toFixed(0)}s left)`);
  }
}

// One scale for every vector keeps ranking unchanged: dot products just get multiplied by scale².
let maxAbs = 0;
for (const x of floats) maxAbs = Math.max(maxAbs, Math.abs(x));
const scale = 127 / maxAbs;
const int8 = new Int8Array(floats.length);
for (let i = 0; i < floats.length; i++) int8[i] = Math.round(floats[i] * scale);

const kb = {
  version: 2,
  model: MODEL_FILE,
  dims,
  scale,
  builtAt: new Date().toISOString(),
  destinations: destinations.map(({ id, name, type, parent, path: p, island_group, lat, lng }) => ({
    id, name, type, parent, path: p, island_group, lat, lng,
  })),
  chunks: chunks.map(({ id, destination_id, destination, kind, category, name, text, lat, lng, source_url }) => ({
    id, destination_id, destination, kind, category, name, text, lat, lng, source_url,
  })),
  vectors: Buffer.from(int8.buffer).toString('base64'),
};

fs.mkdirSync(path.join(root, 'data/v2'), { recursive: true });
const out = path.join(root, 'data/v2/kb.json');
fs.writeFileSync(out, JSON.stringify(kb));
console.log(`\nWrote ${out}: ${chunks.length} chunks, ${dims} dims, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${truncated} truncated`);
await llama.dispose();
