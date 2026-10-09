// Retrieval over data/v2/kb.json (built by scripts/build-kb.mjs).
// Plain JS with no imports, shared by the app (llama.rn) and scripts/ask.mjs (node-llama-cpp):
// detect destination + intent -> filter chunks -> rank by dot product -> top 3 -> explainer prompt.
// Embedding and generation are passed in, so this file never touches a model runtime.

// ---- Text helpers ----

const stripAccents = (s) => (typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s);

const fold = (s) =>
  stripAccents(String(s || '').toLowerCase().replace(/ñ/g, 'n'))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- Loading ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToInt8(b64) {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const len = b64.length;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((len * 3) / 4 - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const n =
      (lookup[b64.charCodeAt(i)] << 18) |
      (lookup[b64.charCodeAt(i + 1)] << 12) |
      (lookup[b64.charCodeAt(i + 2)] << 6) |
      lookup[b64.charCodeAt(i + 3)];
    if (p < bytes.length) bytes[p++] = (n >> 16) & 255;
    if (p < bytes.length) bytes[p++] = (n >> 8) & 255;
    if (p < bytes.length) bytes[p++] = n & 255;
  }
  return new Int8Array(bytes.buffer);
}

// Destination names that are also everyday Tagalog/English words ("iba" = other, "pila" = line).
// They only match with a disambiguator, e.g. "Pila, Laguna" won't, so ask for the province instead.
const AMBIGUOUS_NAMES = new Set(['iba', 'bago', 'pila', 'bato', 'labo', 'palo', 'pili', 'santa', 'luna', 'tuba', 'anda', 'mati', 'ipil']);

/** Prepares kb.json for searching. Do this once and keep the result. */
export function loadKb(kb) {
  const vectors = base64ToInt8(kb.vectors);
  if (vectors.length !== kb.chunks.length * kb.dims) throw new Error('kb.json vectors do not match chunks');

  // Name index, longest first so "Cebu City" wins over "Cebu".
  const byKey = new Map();
  for (const d of kb.destinations) {
    const base = d.name.replace(/\s*\(.*\)$/, '');
    const key = fold(base);
    if (key.length < 3 || AMBIGUOUS_NAMES.has(key)) continue;
    const qualifier = fold((d.name.match(/\((.*)\)$/) || [])[1]);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ dest: d, qualifier });
  }
  const names = [...byKey.keys()]
    .sort((a, b) => b.length - a.length)
    .map((key) => ({ key, re: new RegExp(`(^| )${escapeRe(key)}( |$)`), entries: byKey.get(key) }));

  // Folded name + text per chunk, for the keyword boost in rank().
  const folded = kb.chunks.map((c) => ` ${fold(`${c.name} ${c.text}`)} `);

  return { ...kb, vectors, names, folded };
}

// ---- Keyword boost ----
// Embeddings alone let broad "about Cavite" overviews outrank the one chunk that mentions hiking,
// so each question word that also appears in a chunk adds a little to its score.

const KEYWORD_BOOST = 0.012;
const STOPWORDS = new Set(
  `about after again also around because before being best between could does doing down during each from going good have here into just like look looking many more most much near nice only other over place places really should some spot spots such than that their them then there these they thing things this those through very visit want what when where which while will with would your
  ako ang ano aling ayon bakit dito doon gusto galing kami kayo lang mga naman para pero saan sana sila siya tayo yung maganda magandang pumunta puntahan sana`.split(/\s+/),
);
const stem = (w) => w.replace(/(ings?|ers?|ed|es|s)$/, '');

function keywordStems(question, destinations) {
  const skip = new Set(destinations.flatMap((d) => fold(d.name).split(' ')));
  return [
    ...new Set(
      fold(question)
        .split(' ')
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !skip.has(w))
        .map(stem)
        .filter((s) => s.length >= 3),
    ),
  ];
}

// ---- Understanding the question ----

/** Destinations named in the question (all same-named ones unless a qualifier like "(Cebu)" is also mentioned). */
export function detectDestinations(index, question) {
  const q = fold(question);
  const hit = index.names.find((n) => n.re.test(q));
  if (!hit) return [];
  const qualified = hit.entries.filter((e) => e.qualifier && new RegExp(`(^| )${escapeRe(e.qualifier)}( |$)`).test(q));
  return (qualified.length ? qualified : hit.entries).map((e) => e.dest);
}

const DEFAULT_CATEGORIES = ['see', 'do', 'overview'];
const INTENTS = [
  { categories: ['eat'], re: /\b(eat|food|foods|restaurants?|kain|kumain|makakain|masarap|lechon|pagkain|breakfast|lunch|dinner|merienda)\b/ },
  { categories: ['drink'], re: /\b(bars?|nightlife|clubs?|inuman|beer|drinks?|cocktails?)\b/ },
  { categories: ['buy'], re: /\b(shop|shopping|malls?|markets?|pasalubong|souvenirs?|bumili|bilihan)\b/ },
  { categories: ['sleep'], re: /\b(stay|hotels?|hostels?|resorts?|tulog|matulog|accommodation|lodging|tutuluyan)\b/ },
  {
    categories: ['get_in', 'get_around'],
    re: /\b(how (do|can|should) (i|we) get|how to get|get (to|there|around)|getting (to|there|around)|paano (pumunta|makarating|makapunta)|commute|transport|transportation|bus|buses|jeeps?|jeepneys?|ferry|ferries|boat|flights?|fly|tricycles?|vans?|sakay|sumakay|byahe|biyahe|ruta|route|terminal|airport|pier|port)\b/,
  },
];

/** Which chunk categories the question is about. */
export function detectCategories(question) {
  const q = fold(question);
  const matched = INTENTS.filter((i) => i.re.test(q)).flatMap((i) => i.categories);
  return matched.length ? [...new Set(matched)] : DEFAULT_CATEGORIES;
}

const TRAVEL_WORDS =
  /\b(visit|tour|tourist|attractions?|sights?|sightseeing|beach|beaches|hike|hiking|trek|trekking|falls|islands?|mountains?|museums?|churches|church|things to do|itinerary|travel|trip|vacation|gala|pasyalan|puntahan|gawin|bundok|dagat|isla)\b/;

/** True when the question names a place or asks about doing, eating, staying or getting somewhere. */
export function looksLikeTravelQuestion(index, question) {
  const q = fold(question);
  return detectDestinations(index, question).length > 0 || TRAVEL_WORDS.test(q) || INTENTS.some((i) => i.re.test(q));
}

/** Destination ids for the named places plus everything under them ("Cavite" includes Tagaytay). */
function destinationScope(index, dests) {
  if (!dests.length) return null;
  const names = new Set(dests.map((d) => d.name));
  const ids = new Set(dests.map((d) => d.id));
  for (const d of index.destinations) if (d.path?.some((p) => names.has(p))) ids.add(d.id);
  return ids;
}

// ---- Search ----

export const queryText = (question) => `query: ${question}`;

function rank(index, qvec, keep, k, keywords) {
  const { vectors, dims, chunks, scale, folded } = index;
  const patterns = keywords.map((w) => ` ${w}`);
  const top = [];
  for (let i = 0; i < chunks.length; i++) {
    if (!keep(chunks[i])) continue;
    let s = 0;
    const off = i * dims;
    for (let j = 0; j < dims; j++) s += vectors[off + j] * qvec[j];
    s /= scale;
    for (const p of patterns) if (folded[i].includes(p)) s += KEYWORD_BOOST;
    if (top.length < k || s > top[top.length - 1].s) {
      top.push({ i, s });
      top.sort((a, b) => b.s - a.s);
      if (top.length > k) top.pop();
    }
  }
  return top.map(({ i, s }) => ({ chunk: chunks[i], score: s }));
}

/**
 * @param qvec normalized embedding of queryText(question), same model as the KB
 * @returns {{ destinations, categories, hits: {chunk, score}[] }}
 */
export function search(index, question, qvec, k = 3) {
  const destinations = detectDestinations(index, question);
  const categories = detectCategories(question);
  const scope = destinationScope(index, destinations);
  const cats = new Set(categories);
  const kw = keywordStems(question, destinations);

  // Narrowest first; widen when the filters leave too little to choose from.
  let hits = rank(index, qvec, (c) => (!scope || scope.has(c.destination_id)) && cats.has(c.category), k, kw);
  if (hits.length < k && scope) hits = rank(index, qvec, (c) => scope.has(c.destination_id), k, kw);
  if (hits.length < k) hits = rank(index, qvec, (c) => cats.has(c.category), k, kw);

  return { destinations: destinations.map((d) => d.name), categories, hits };
}

// ---- Explainer prompt ----

// A small model copies a worked example far better than it follows rules, so the example
// carries most of the tone: straight to the point, "you", no "based on the sources".
export const SYSTEM_PROMPT = `You are Ducky, a friendly local travel buddy in the Philippines, chatting with a traveler on their phone.
Use only the facts in the notes. Never invent places, prices, times or routes. If the notes don't cover the question, say so in one sentence.
Talk like a helpful friend: start with a suggestion, speak to the traveler as "you", and keep it to 2 to 4 short sentences.
Suggest, don't decide: offer one to three ideas with "you might like", "you could" or "if you're up for it", and let the traveler choose. Never tell them what they want or what they must do.
Never say "based on the sources", "the source states" or "according to the information", and never repeat the question back.

Example
Notes:
- Tagaytay (Cavite, things to do): A ridge city cooler than Manila, known for its views of Taal Volcano and hot bulalo soup.
- Silang (Cavite, getting there): Buses to Tagaytay pass through Silang; sweet corn stalls line the bypass road.
Question: what's fun to do in Cavite?
Answer: You might enjoy a trip up to Tagaytay. It's cooler than Manila, and the view of Taal Volcano goes great with a hot bowl of bulalo. If you pass through Silang, you could also grab some boiled sweet corn from the stalls on the bypass road.`;

const LABEL = {
  overview: 'about the place', understand: 'background', see: 'to see', do: 'things to do', eat: 'food', drink: 'nightlife',
  buy: 'shopping', sleep: 'where to stay', get_in: 'getting there', get_around: 'getting around', go_next: 'nearby trips',
};


// Short sources keep the prompt fast to read on a phone.
function clip(text, max = 450) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

// Section chunks are named after their heading ("Do", "Get in / By bus"), which the model would
// parrot, so they're labelled by place instead; listings keep their real name.
function noteLabel(c) {
  const what = LABEL[c.category] || c.category;
  return c.kind === 'listing' ? `${c.name} (${c.destination}, ${what})` : `${c.destination} (${what})`;
}

/**
 * Chat messages for the explainer: system prompt, then the notes and the question.
 * Replies come back in English: Qwen2.5-0.5B garbles Tagalog when asked for it, so Tagalog
 * replies wait for a bigger explainer.
 */
export function buildMessages(question, hits) {
  const notes = hits.map(({ chunk: c }) => `- ${noteLabel(c)}: ${clip(c.text).replace(/\s*\n+\s*/g, ' ')}`).join('\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Notes:\n${notes}\nQuestion: ${question}\nAnswer:` },
  ];
}

// Phrases a small model still slips in now and then; trimmed so the reply reads like a person.
const META_OPENERS =
  /^\s*(?:(?:based on|according to|from) (?:the |these )?(?:sources?|notes?|information|info)(?: (?:provided|given|above))?[,:]?\s*|(?:batay sa|ayon sa) (?:mga )?(?:sources?|notes?|impormasyon)[,:]?\s*)/i;
const META_INLINE = /\b(?:the |these )?(?:sources?|notes?) (?:states?|says?|mentions?|indicates?|suggests?)(?: that)?[,:]?\s*/gi;
// Sentence openers that decide for the traveler, softened into suggestions.
const BOSSY_OPENERS = [
  [/(^|[.!?]\s+)You want to\b/g, '$1You could'],
  [/(^|[.!?]\s+)You should\b/g, '$1You could'],
  [/(^|[.!?]\s+)You must\b/g, '$1You might want to'],
  [/(^|[.!?]\s+)You need to\b/g, '$1You may want to'],
];

/** Cleans the explainer's text; safe to run on partial text while it streams. */
export function polishAnswer(text) {
  let out = text.replace(/^\s*Answer:\s*/i, '').replace(META_OPENERS, '').replace(META_INLINE, '').replace(/\s*\[\d+\]/g, '');
  out = out.charAt(0).toUpperCase() + out.slice(1);
  for (const [re, to] of BOSSY_OPENERS) out = out.replace(re, to);
  return out;
}

/** "Sources: Wikivoyage — …" line; the CC BY-SA licence requires the credit. */
export function attribution(hits) {
  const pages = [...new Set(hits.map((h) => h.chunk.destination))];
  return `Sources: Wikivoyage (${pages.join(', ')}), CC BY-SA`;
}
