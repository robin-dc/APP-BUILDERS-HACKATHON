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
  // Moving around inside a place vs getting there are different chunks; "how would I get around"
  // should not pull Manila-to-Baguio bus routes.
  {
    categories: ['get_around'],
    specific: true,
    re: /\b(get(ting)? around|go around|move around|ikot|umikot|mag ?ikot|within the (city|town|island)|around (the )?(city|town|island))\b/,
  },
  {
    categories: ['get_in'],
    specific: true,
    re: /\b(how (do|can|should|would) (i|we) get (to|there)|how to get (to|there)|get(ting)? (to|there)|paano (pumunta|makarating|makapunta)|galing|from manila)\b/,
  },
  {
    categories: ['get_in', 'get_around'],
    re: /\b(commute|transport|transportation|bus|buses|jeeps?|jeepneys?|ferry|ferries|boat|flights?|fly|tricycles?|vans?|sakay|sumakay|byahe|biyahe|ruta|route|terminal|airport|pier|port)\b/,
  },
];

/** Which chunk categories the question is about. */
export function detectCategories(question) {
  const q = fold(question);
  const matched = INTENTS.filter((i) => i.re.test(q)).flatMap((i) => i.categories);
  // A specific "get around" / "get there" question wins over the generic transport words.
  const specific = INTENTS.filter((i) => i.specific && i.re.test(q)).flatMap((i) => i.categories);
  const transport = new Set(['get_in', 'get_around']);
  const result = specific.length ? [...matched.filter((c) => !transport.has(c)), ...specific] : matched;
  return result.length ? [...new Set(result)] : DEFAULT_CATEGORIES;
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

// A small model copies worked examples far better than it follows rules, so the two examples
// carry most of the tone: a warm guide who points out the views, suggests rather than decides,
// and still gives the practical facts (the commute example keeps directions useful).
export const SYSTEM_PROMPT = `You are Ducky, a warm and cheerful local tour guide in the Philippines, chatting with a traveler on their phone.
You love your country and want the traveler to slow down and enjoy it: point out the views, the nature and the little moments worth savoring along the way.
Use only the facts in the notes. Never invent places, views, prices, times or routes, and only praise sights the notes actually describe. If the notes don't cover the question, say so kindly in one sentence.
Suggest, don't decide: offer one to three ideas with "you might love", "you could" or "if you're up for it", and let the traveler choose.
Speak to the traveler as "you", keep it to 3 or 4 short sentences, and end with a warm nudge to take in the scenery.
Never say "based on the sources", "the source states" or "according to the information", and never repeat the question back.

Example
Notes:
- Tagaytay (Cavite, things to do): A ridge city cooler than Manila, known for its views of Taal Volcano and hot bulalo soup.
- Silang (Cavite, getting there): Buses to Tagaytay pass through Silang; sweet corn stalls line the bypass road.
Question: what's fun to do in Cavite?
Answer: You might love a trip up to Tagaytay, where the air turns cool and Taal Volcano sits right below the ridge. A hot bowl of bulalo with that view is hard to beat! If you pass through Silang, you could grab some boiled sweet corn from the roadside stalls. Take your time up there and just enjoy the view.

Example
Notes:
- Baguio (getting there): Buses from Metro Manila take about 4 to 5 hours; the last part climbs through pine-covered mountains.
Question: how do I get to Baguio?
Answer: You could hop on a bus from Metro Manila, and the trip takes about 4 to 5 hours. The best part comes near the end, when the road climbs into pine-covered mountains. If you can, grab a window seat and watch the scenery change as you go up!`;

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
  [/\bYou could love\b/g, 'You might love'],
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

// The tour guide's sign-off. The small model often skips it, so it's added in code; it carries
// no facts, so it can't contradict the sources. Picked by topic, varied by question.
const NUDGES = {
  scenery: [
    'Take your time and soak in the view!',
    "Don't rush it. Pause, look around, and enjoy how beautiful it is.",
    'Bring a camera, but take a moment to just enjoy it with your own eyes too.',
  ],
  commute: [
    'If you can, grab a window seat and enjoy the scenery along the way!',
    'Sit back and enjoy the ride. The trip is part of the adventure.',
  ],
  food: ['Enjoy every bite!', 'Savor it slowly. Food tastes even better with good company and a nice view.'],
  stay: ['Rest well, and catch the sunrise if you can!'],
};
const ALREADY_NUDGED = /\b(enjoy|soak|savor|savour|take your time|scenery|window seat)\b[^.!?]*[.!?]?\s*$/i;

/** Adds the guide's warm closing line unless the answer already ends on one. */
export function withNudge(answer, categories, question = '') {
  if (!answer || ALREADY_NUDGED.test(answer)) return answer;
  const cats = new Set(categories);
  const topic = cats.has('get_in') || cats.has('get_around') ? 'commute' : cats.has('eat') || cats.has('drink') ? 'food' : cats.has('sleep') ? 'stay' : 'scenery';
  const options = NUDGES[topic];
  let h = 0;
  for (let i = 0; i < question.length; i++) h = (h * 31 + question.charCodeAt(i)) >>> 0;
  return `${answer} ${options[h % options.length]}`;
}

/** "Sources: Wikivoyage — …" line; the CC BY-SA licence requires the credit. */
export function attribution(hits) {
  const pages = [...new Set(hits.map((h) => h.chunk.destination))];
  return `Sources: Wikivoyage (${pages.join(', ')}), CC BY-SA`;
}
