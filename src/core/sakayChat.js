// "Sakay o hintay" chat flow, ported from the send() loop in jeep-predictor's sakay-o-hintay.html.
// The engine (readSentence, decide, writeReply, detectLanguage) lives in ./model.js, copied from
// that project's app/www/model.js; update it by rebuilding there and copying it over, not by editing it here.

import { decide, detectLanguage, readSentence, writeReply, WEATHER } from './model';

export const NEW_TRIP = 'New trip';

const EXAMPLES = [
  'Umuulan, puno na ang jeep, 30 minutes na lang ako',
  "It's sunny, the jeep has seats, I have 45 minutes",
  'Malakas ang ulan, sabit na lang, bawal ma-late',
];

const SAY = {
  en: {
    hello:
      'Kumusta! Tell me what you see at the stop: the weather, how full the jeep is, and how many minutes you have. English, Tagalog or Taglish all work.',
    got: (x) => `Got it: ${x}.`,
    askMins: 'How many minutes until you need to be there?',
    askJeep: 'How full is the jeep in front of you?',
    lost: 'I did not catch that. Tell me the weather, how full the jeep is, or how many minutes you have.',
    assumed: (x) => `(You did not mention the weather, so I used ${x.toLowerCase()}.)`,
    mins: ['I have 15 minutes', 'I have 30 minutes', 'I have 1 hour'],
    jeep: ['The jeep has seats', 'The jeep is full', 'Hanging on only'],
  },
  tl: {
    got: (x) => `Sige: ${x}.`,
    askMins: 'Ilang minuto pa bago ka dapat nandoon?',
    askJeep: 'Gaano kapuno ang jeep sa harap mo?',
    lost: 'Hindi ko nakuha. Sabihin mo ang panahon, kung gaano kapuno ang jeep, o ilang minuto pa ang meron ka.',
    assumed: (x) => `(Hindi mo nabanggit ang panahon, kaya ${x.toLowerCase()} ang ginamit ko.)`,
    mins: ['15 minutes na lang', '30 minutes na lang', '1 oras pa'],
    jeep: ['May upuan pa', 'Puno na', 'Sabit na lang'],
  },
};
SAY.mix = { ...SAY.tl, got: (x) => `Okay: ${x}.`, askMins: 'Ilang minutes pa bago ka dapat nandoon?' };

// The page's starting values for the inputs the chat fills in.
const DEFAULT_CONDITIONS = { weather: 'clear', jeep: 'tight', importance: 'normal', minsLeft: 45, usualRide: 25, tags: [] };
const KNOWN_KEYS = ['weather', 'jeep', 'minsLeft', 'usualRide', 'importance'];

const reply = (text, suggestions) => ({ role: 'assistant', text, suggestions });

// The page bolds the first sentence of the verdict.
const boldFirst = (text) => {
  const cut = text.indexOf('. ') + 1;
  return cut > 0 ? `**${text.slice(0, cut)}**${text.slice(cut)}` : text;
};

const clock = (now) => ({
  hour: now.getHours() + now.getMinutes() / 60,
  weekend: now.getDay() === 0 || now.getDay() === 6,
});

// Same rules as the page's applyValues(): stated values overwrite, and tags from the previous
// message that this one doesn't repeat are dropped.
function applyValues(state, v) {
  const conditions = { ...state.conditions };
  for (const k of KNOWN_KEYS) if (v[k] !== undefined) conditions[k] = v[k];

  const said = v.tags || [];
  const drop = new Set([...state.sentenceTags.filter((t) => !said.includes(t)), ...(v.notTags || [])]);
  conditions.tags = [...new Set([...conditions.tags.filter((t) => !drop.has(t)), ...said])];

  const known = { ...state.known };
  for (const k of KNOWN_KEYS) if (v[k] !== undefined) known[k] = true;
  return { conditions, known, sentenceTags: said };
}

/** A fresh conversation: the opening message plus empty state. */
export function newChat(opening) {
  return {
    state: { conditions: { ...DEFAULT_CONDITIONS }, known: {}, sentenceTags: [], lang: 'en' },
    message: reply(opening || SAY.en.hello, EXAMPLES),
  };
}

/**
 * One turn of the chat.
 * @param state  from newChat() or the previous handleMessage()
 * @param raw    what the user typed or tapped
 * @param trips  logged trips for decide(); [] until trip logging exists here
 * @returns {{ state, message }} message is a ChatMessage-shaped assistant reply (minus id)
 */
export function handleMessage(state, raw, trips = [], now = new Date()) {
  const text = String(raw || '').trim();
  if (text === NEW_TRIP) return newChat();

  const lang = detectLanguage(text) || state.lang;
  const say = SAY[lang];
  const { hour, weekend } = clock(now);
  const r = readSentence(text, hour);

  if (!r.understood.length && !(r.values.notTags || []).length) {
    return { state: { ...state, lang }, message: reply(say.lost, EXAMPLES) };
  }

  const next = { ...applyValues(state, r.values), lang };
  const got = r.understood.length ? `${say.got(r.understood.join(', '))} ` : '';
  if (!next.known.minsLeft) return { state: next, message: reply(got + say.askMins, say.mins) };
  if (!next.known.jeep) return { state: next, message: reply(got + say.askJeep, say.jeep) };

  const input = { ...next.conditions, hour, weekend };
  let answer = writeReply(decide(input, trips), input, lang);
  if (!next.known.weather) answer += ` ${say.assumed(WEATHER[input.weather].label)}`;
  return { state: next, message: reply(boldFirst(answer), [NEW_TRIP]) };
}
