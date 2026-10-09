// Runs the app's KB pipeline on this laptop with the same GGUFs and the same retrieval code:
// question -> e5 embedding -> search data/v2/kb.json -> top 3 -> Qwen explanation.
//   npm run ask                      # built-in sample questions
//   npm run ask -- "your question"   # one question
//   npm run ask -- --no-llm "..."    # retrieval only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { attribution, buildMessages, loadKb, polishAnswer, queryText, search } from '../src/core/kb/retrieve.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const noLlm = args.includes('--no-llm');
const asked = args.filter((a) => a !== '--no-llm');

const SAMPLES = [
  'I am at cavite and want to enjoy hiking, where do you suggest I go',
  'what should I do in Cebu City for 3 days?',
  'paano pumunta sa Baguio galing Manila?',
  'saan masarap kumain sa Iloilo?',
  'how do I get around Puerto Princesa?',
  'famous beaches in Siargao',
];
const questions = asked.length ? asked : SAMPLES;

const index = loadKb(JSON.parse(fs.readFileSync(path.join(root, 'data/v2/kb.json'), 'utf8')));
const llama = await getLlama();
const embedModel = await llama.loadModel({ modelPath: path.join(root, 'models', index.model) });
const embedCtx = await embedModel.createEmbeddingContext({ contextSize: 512 });

let chat = null;
if (!noLlm) {
  const qwen = await llama.loadModel({ modelPath: path.join(root, 'models/qwen2.5-0.5b-instruct-q4_k_m.gguf') });
  const ctx = await qwen.createContext({ contextSize: 2048 });
  chat = { seq: ctx.getSequence() };
}

async function embed(text) {
  const v = (await embedCtx.getEmbeddingFor(text)).vector;
  const n = Math.hypot(...v);
  return Float32Array.from(v, (x) => x / n);
}

for (const question of questions) {
  const t0 = Date.now();
  const qvec = await embed(queryText(question));
  const t1 = Date.now();
  const { destinations, categories, hits } = search(index, question, qvec);
  const t2 = Date.now();

  console.log(`\n=== ${question}`);
  console.log(`destination: ${destinations.join(', ') || '(none, searching everywhere)'}  categories: ${categories.join(', ')}`);
  hits.forEach(({ chunk: c, score }, i) =>
    console.log(`  [${i + 1}] ${score.toFixed(3)}  ${c.name} (${c.category}, ${c.destination})  ${c.text.slice(0, 90).replace(/\n/g, ' ')}…`),
  );
  console.log(`  embed ${t1 - t0}ms, search ${t2 - t1}ms`);
  if (!chat) continue;

  // Same settings as src/ai/travelGuide.js.
  const [system, user] = buildMessages(question, hits);
  const session = new LlamaChatSession({ contextSequence: chat.seq, systemPrompt: system.content });
  const t3 = Date.now();
  const answer = await session.prompt(user.content, { temperature: 0.5, maxTokens: 200 });
  session.dispose({ disposeSequence: false });
  await chat.seq.clearHistory();
  console.log(`\n${polishAnswer(answer.trim())}\n${attribution(hits)}\n  (explain ${Date.now() - t3}ms)`);
}
await llama.dispose();
