// Web build only (Metro picks this over models.js): the browser can't run llama.rn, so the two
// model calls go to scripts/dev-ai-server.mjs on localhost, which runs the same GGUFs from models/.
// Same interface as the llama.rn contexts that models.js returns.

const SERVER = 'http://localhost:8787';

const post = (route, body, signal) =>
  fetch(`${SERVER}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).then((res) => {
    if (!res.ok) throw new Error(`dev AI server: ${route} returned ${res.status}`);
    return res;
  });

const embedder = {
  async embedding(text) {
    return (await post('/embed', { text })).json();
  },
};

let abort = null;
const explainer = {
  async completion(params, onToken) {
    abort = new AbortController();
    const res = await post('/complete', params, abort.signal);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines.filter(Boolean)) {
          const msg = JSON.parse(line);
          if (msg.token) {
            text += msg.token;
            onToken?.({ token: msg.token });
          }
          if (msg.done) text = msg.text;
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') throw e;
    }
    return { text };
  },
  async stopCompletion() {
    abort?.abort();
  },
};

const unreachable = (e) => {
  throw new Error(`Start the dev AI server first: npm run dev:ai (${e?.message ?? e})`);
};

export const getEmbedder = () => fetch(`${SERVER}/`).then(() => embedder, unreachable);
export const getExplainer = () => Promise.resolve(explainer);
