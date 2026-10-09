// Localhost stand-in for llama.rn, so the app's web build can use the same two GGUFs from models/.
// Only for development: the phone app runs the models itself (src/ai/models.js).
//   npm run dev:ai        then, in another terminal: npx expo start --web
//
// POST /embed     {text}                              -> {embedding: number[]}
// POST /complete  {messages, n_predict, temperature}  -> NDJSON stream: {"token":"..."} lines, then {"done":true,"text":"..."}
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const PORT = 8787;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modelPath = (file) => path.join(root, 'models', file);

const llama = await getLlama();
const embedModel = await llama.loadModel({ modelPath: modelPath('multilingual-e5-small-q8_0.gguf') });
const embedCtx = await embedModel.createEmbeddingContext({ contextSize: 512 });
const qwen = await llama.loadModel({ modelPath: modelPath('qwen2.5-0.5b-instruct-q4_k_m.gguf') });
const sequence = (await qwen.createContext({ contextSize: 2048 })).getSequence();

// One generation at a time, like the single llama.rn context on the phone.
let queue = Promise.resolve();
const serially = (fn) => (queue = queue.then(fn, fn));

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });

async function complete({ messages, n_predict = 220, temperature = 0.3 }, res, signal) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const user = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
  const session = new LlamaChatSession({ contextSequence: sequence, systemPrompt: system });
  try {
    const text = await session.prompt(user, {
      maxTokens: n_predict,
      temperature,
      signal,
      stopOnAbortSignal: true,
      onTextChunk: (token) => res.write(`${JSON.stringify({ token })}\n`),
    });
    res.end(`${JSON.stringify({ done: true, text })}\n`);
  } finally {
    session.dispose({ disposeSequence: false });
    await sequence.clearHistory();
  }
}

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') return res.end();
    try {
      if (req.method === 'POST' && req.url === '/embed') {
        const { text } = await readJson(req);
        const { vector } = await embedCtx.getEmbeddingFor(text);
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ embedding: vector }));
      }
      if (req.method === 'POST' && req.url === '/complete') {
        const body = await readJson(req);
        const abort = new AbortController();
        res.on('close', () => abort.abort()); // the app's Stop button closes the request
        res.setHeader('content-type', 'application/x-ndjson');
        return serially(() => complete(body, res, abort.signal));
      }
      res.statusCode = 404;
      res.end();
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  })
  .listen(PORT, () => console.log(`dev AI server on http://localhost:${PORT} (e5 + qwen2.5-0.5b loaded)`));
