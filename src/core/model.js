// Sakay o Hintay prediction model. Built from sakay-o-hintay.html by build.js; edit the model there.
// In a web page: <script src="model.js"></script>, then call decide(input, trips).
// In Node or a bundler: const { decide } = require("./model.js").
/*MODEL-START*/
const WEATHER = {
  clear:  { label: 'Clear',      wait: 1,   ride: 1,    standing: 1,   rainy: false },
  cloudy: { label: 'Cloudy',     wait: 1,   ride: 1,    standing: 1,   rainy: false },
  light:  { label: 'Light rain', wait: 1.3, ride: 1.15, standing: 1.5, rainy: true },
  heavy:  { label: 'Heavy rain', wait: 1.8, ride: 1.4,  standing: 2.5, rainy: true }
};
const TAGS = {
  payday:   { label: "Payday",     wait: 1.3, ride: 1.15 },
  roadwork: { label: "Road work",  wait: 1.1, ride: 1.35 },
  longline: { label: "Long line",  wait: 1.6, ride: 1 },
  school:   { label: "School day", wait: 1.2, ride: 1.1 }
};
const tagFactor = (tags, key) => (tags || []).reduce((m, t) => m * (TAGS[t] ? TAGS[t][key] : 1), 1);
const DISCOMFORT = { seat: 0, tight: 4, sabit: 10 };   // per 20 minutes of riding
const LATE_COST = { flex: 10, normal: 30, critical: 90 };
const BASE_WAIT = 6;      // minutes between boardable jeeps before any trips are logged
const PRIOR_WEIGHT = 3;   // the starting estimate counts like three logged trips

function period(hour, weekend) {
  if (hour >= 21 || hour < 5) return 'night';
  if (!weekend && ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 20))) return 'rush';
  return 'normal';
}
function priorWait(ctx) {
  const p = period(ctx.hour, ctx.weekend);
  return BASE_WAIT * WEATHER[ctx.weather].wait * (p === 'rush' ? 1.6 : p === 'night' ? 1.8 : ctx.weekend ? 0.9 : 1) * tagFactor(ctx.tags, 'wait');
}
function priorRideRatio(ctx) {
  const p = period(ctx.hour, ctx.weekend);
  return WEATHER[ctx.weather].ride * (p === 'rush' ? 1.3 : p === 'night' ? 0.9 : 1) * tagFactor(ctx.tags, 'ride');
}
// How much a past trip resembles the current situation, 0..1.
function similarity(ctx, t) {
  const a = WEATHER[ctx.weather], b = WEATHER[t.weather] || WEATHER.clear;
  const w = ctx.weather === t.weather ? 1 : a.rainy === b.rainy ? 0.7 : 0.3;
  const d = Math.abs(ctx.hour - t.hour), dh = Math.min(d, 24 - d);
  const h = Math.exp(-Math.pow(dh / 2, 2));
  // Trips with the same tags count the most; no tags on both sides is a full match.
  const mine = ctx.tags || [], theirs = t.tags || [];
  const union = new Set(mine.concat(theirs)).size;
  const g = union ? 0.4 + 0.6 * mine.filter(x => theirs.includes(x)).length / union : 1;
  return w * h * g * (ctx.weekend === !!t.weekend ? 1 : 0.6);
}
// Starting estimate blended with similar logged trips.
function estimate(ctx, trips, valueOf, prior) {
  let sw = 0, swx = 0;
  for (const t of trips) {
    const x = valueOf(t);
    if (typeof x !== 'number' || !isFinite(x)) continue;
    const w = similarity(ctx, t);
    sw += w; swx += w * x;
  }
  return { mean: (prior * PRIOR_WEIGHT + swx) / (PRIOR_WEIGHT + sw), weight: sw };
}
function predictWait(ctx, trips) {
  return estimate(ctx, trips, t => t.action === 'waited' ? t.waitMin : NaN, priorWait(ctx));
}
function predictRide(ctx, trips, usualRide) {
  const r = estimate(ctx, trips, t => (t.rideMin > 0 && t.usualRide > 0) ? t.rideMin / t.usualRide : NaN, priorRideRatio(ctx));
  return { mean: r.mean * usualRide, weight: r.weight };
}
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const DECILES = [-1.28, -0.84, -0.52, -0.25, 0, 0.25, 0.52, 0.84, 1.28];

// ---- Trained model: logistic regression on the logged trips, predicting the chance of being late ----
const TRAIN_MIN = { trips: 30, late: 5, onTime: 5, waited: 5, rode: 5 };
const FACTORS = [null, null, null, 'Weekends', 'Rush hour', 'Rain', 'Payday', 'Road work', 'A long line', 'School days', null, 'Waiting for the next jeep', null];
function features(x) {
  const h = x.hour * Math.PI / 12, tags = x.tags || [];
  const slack = Math.max(-3, Math.min(3, (x.minsLeft - x.usualRide) / 20));
  const waited = x.action === 'waited' ? 1 : 0;
  return [1, Math.sin(h), Math.cos(h), x.weekend ? 1 : 0, period(x.hour, !!x.weekend) === 'rush' ? 1 : 0,
    x.weather === 'heavy' ? 1 : x.weather === 'light' ? 0.5 : 0,
    tags.includes('payday') ? 1 : 0, tags.includes('roadwork') ? 1 : 0, tags.includes('longline') ? 1 : 0, tags.includes('school') ? 1 : 0,
    slack, waited, waited * slack];
}
const sigmoid = z => 1 / (1 + Math.exp(-z));
const dot = (w, x) => w.reduce((s, v, i) => s + v * x[i], 0);
const predictLate = (model, x) => sigmoid(dot(model.w, features(x)));
function trainLate(trips) {
  const rows = trips.filter(t => typeof t.onTime === 'boolean' && isFinite(t.minsLeft) && isFinite(t.usualRide) && (t.action === 'rode' || t.action === 'waited'));
  const counts = { trips: rows.length, late: rows.filter(t => !t.onTime).length, waited: rows.filter(t => t.action === 'waited').length };
  counts.onTime = counts.trips - counts.late; counts.rode = counts.trips - counts.waited;
  const ready = Object.keys(TRAIN_MIN).every(k => counts[k] >= TRAIN_MIN[k]);
  if (!ready) return { ready, counts };
  const X = rows.map(features), y = rows.map(t => t.onTime ? 0 : 1), k = X[0].length, w = new Array(k).fill(0);
  for (let it = 0; it < 600; it++) {
    const g = new Array(k).fill(0);
    for (let i = 0; i < X.length; i++) { const e = sigmoid(dot(w, X[i])) - y[i]; for (let j = 0; j < k; j++) g[j] += e * X[i][j]; }
    // A small pull toward zero keeps a few unusual trips from dominating.
    for (let j = 0; j < k; j++) w[j] -= 0.3 * (g[j] / X.length + (j ? 0.05 * w[j] : 0));
  }
  const right = X.filter((x, i) => (sigmoid(dot(w, x)) >= 0.5) === (y[i] === 1)).length;
  return { ready, counts, w, accuracy: right / X.length, blend: rows.length / (rows.length + TRAIN_MIN.trips) };
}
let trainedCache = { key: null, model: null };
function trainedFor(trips) {
  const key = trips.length + '|' + trips.reduce((s, t) => s + (t.ts || 0) + (t.onTime ? 1 : 0), 0);
  if (trainedCache.key !== key) trainedCache = { key, model: trainLate(trips) };
  return trainedCache.model;
}

function decide(input, trips) {
  const ctx = { hour: input.hour, weekend: input.weekend, weather: input.weather, tags: input.tags || [] };
  const wait = predictWait(ctx, trips);
  const ride = predictRide(ctx, trips, input.usualRide);
  const slack = input.minsLeft - ride.mean;          // spare minutes if I board right now
  const sd = 0.2 * ride.mean + 2;                    // how much the ride time varies
  let pRide = 1 - normCdf(slack / sd);
  // Waiting: the next jeep arrives after an exponential wait with the predicted mean.
  let pWait = 0;
  for (const z of DECILES) {
    const s = slack - z * sd;
    pWait += s <= 0 ? 1 : Math.exp(-s / wait.mean);
  }
  pWait /= DECILES.length;
  // Once enough trips are logged, the trained model shares the late-or-not odds with the estimate above.
  const model = trainedFor(trips);
  if (model.ready) {
    const x = { hour: input.hour, weekend: input.weekend, weather: input.weather, tags: ctx.tags, minsLeft: input.minsLeft, usualRide: input.usualRide };
    pRide = (1 - model.blend) * pRide + model.blend * predictLate(model, Object.assign({ action: 'rode' }, x));
    pWait = (1 - model.blend) * pWait + model.blend * predictLate(model, Object.assign({ action: 'waited' }, x));
  }

  const wx = WEATHER[input.weather];
  const per = period(input.hour, input.weekend);
  const rideUnits = ride.mean / 20;
  const rain = input.jeep === 'sabit' ? wx.standing : 1;
  const costRide = DISCOMFORT[input.jeep] * rideUnits * rain + pRide * LATE_COST[input.importance];
  const nextJeepDiscomfort = (per === 'rush' ? 4 : 1) * rideUnits;
  const costWait = wait.mean * wx.standing + pWait * LATE_COST[input.importance] + nextJeepDiscomfort;
  const diff = Math.abs(costRide - costWait) / (Math.max(costRide, costWait) + 1);
  return {
    ride: costRide <= costWait, pRide, pWait, slack,
    waitMean: wait.mean, rideMean: ride.mean, evidence: wait.weight + ride.weight, trained: model.ready,
    period: per, strength: diff < 0.15 ? 'close' : diff < 0.4 ? 'leaning' : 'clear'
  };
}

// ---- Sentence reader: turns one typed or spoken sentence (English, Tagalog or Taglish) into inputs by matching known words ----
const NUMBER_WORDS = [
  ['kalahating oras', '30 minutes'], ['half an hour', '30 minutes'], ['half hour', '30 minutes'],
  ['isang oras', '60 minutes'], ['an hour', '60 minutes'], ['one hour', '60 minutes'],
  ["kwarenta'y singko", '45'], ['kwarenta y singko', '45'], ['bente singko', '25'], ['forty[- ]five', '45'], ['twenty[- ]five', '25'],
  ['singkwenta', '50'], ['kwarenta', '40'], ['trenta', '30'], ['bente', '20'], ['kinse', '15'], ['dies', '10'], ['singko', '5'],
  ['sixty', '60'], ['fifty', '50'], ['forty', '40'], ['thirty', '30'], ['twenty', '20'], ['fifteen', '15'], ['ten', '10'], ['five', '5']
];
const JEEP_LABEL = { seat: 'Has seats', tight: 'Tight squeeze', sabit: 'Sabit only' };
const IMPORTANCE_LABEL = { flex: 'Flexible', normal: 'Matters', critical: 'Cannot be late' };
function readSentence(raw, nowHour) {
  let text = ' ' + String(raw || '').toLowerCase().replace(/[’‘]/g, "'") + ' ';
  for (const [word, digits] of NUMBER_WORDS) text = text.replace(new RegExp('\\b' + word + '\\b', 'g'), digits);
  text = text.replace(/(\d+)\s+(na ?lang|left)/g, '$1 minutes $2');
  const v = {}, has = re => re.test(text);

  if (has(/(hindi|di|wala|walang|no|not|tumila)\s+(na\s+|nang\s+)?(umuulan|ulan|rain|raining)|tumila/)) v.weather = 'clear';
  else if (has(/malakas\s+(na\s+|ang\s+)?ulan|heavy rain|raining hard|bumubuhos|buhos|bagyo|storm|typhoon|baha|flood|pouring|downpour/)) v.weather = 'heavy';
  else if (has(/ambon|drizzl|light rain|mahinang ulan|ulan|rain|maulan/)) v.weather = 'light';
  else if (has(/kulimlim|maulap|cloudy|overcast/)) v.weather = 'cloudy';
  else if (has(/maaraw|mainit|sunny|maaliwalas|\bclear\b/)) v.weather = 'clear';

  if (has(/sabit|kapit|hanging|hang on|nakatayo|standing/)) v.jeep = 'sabit';
  else if (has(/(wala|walang|no|not any)\s+(nang\s+|ng\s+|na\s+|more\s+)?(upuan|seats?|bakante|space)/)) v.jeep = 'tight';
  else if (has(/puno|siksik|masikip|\bfull\b|crowded|packed|\btight\b/)) v.jeep = 'tight';
  else if (has(/upuan|maluwag|bakante|\bseats?\b|\bempty\b|walang laman|konti lang/)) v.jeep = 'seat';

  if (has(/hindi\s+(naman\s+)?nagmamadali|no rush|not in a hurry|ok(ay)? lang (na )?ma-?late|flexible|walang hinahabol/)) v.importance = 'flex';
  else if (has(/bawal\s+(akong\s+)?ma-?late|(hindi|di)\s+(ako\s+)?(pwede|puwede)(ng)?\s+ma-?late|can'?t be late|cannot be late|must not be late|interview|\bexam\b|meeting|flight|urgent|importante|nagmamadali|in a hurry|hurry/)) v.importance = 'critical';

  const tags = [], notTags = [];
  if (has(/payday|sweldo|sahod|katapusan|kinsenas/)) tags.push('payday');
  if (has(/road ?work|construction|hukay|ginagawang (kalsada|daan)|sirang (kalsada|daan)|road repair/)) tags.push('roadwork');
  if (has(/pila|long line|queue|(daming|maraming) (tao|pasahero|naghihintay|nakapila)/)) tags.push('longline');
  if (has(/(wala|walang)\s+pasok|no (school|classes)/)) notTags.push('school');
  else if (has(/may pasok|school day|pasukan|klase|estudyante|students?/)) tags.push('school');
  if (tags.length) v.tags = tags;
  if (notTags.length) v.notTags = notTags;

  // Durations: decide from nearby words whether each one is time left or ride time.
  const left = [], ride = [], unsure = [];
  for (const clause of text.split(/[,.;!?]|\b(?:and|tapos|pero|but|kaya|so)\b/)) {
    const found = [];
    clause.replace(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|minutos?|oras|hours?|hrs?)\b/g, (m, n, unit) => { found.push(Math.round(parseFloat(n) * (/^(oras|h)/.test(unit) ? 60 : 1))); return m; });
    if (!found.length) continue;
    const rideCue = /biyahe|byahe|\bride\b|\btrip\b|travel|commute|papunta|layo/.test(clause);
    const leftCue = /na ?lang|\bleft\b|natitira|bago|before|until|kailangan|need|dapat|must|\bhave\b|meron|\bmay\b|late/.test(clause);
    (rideCue && !leftCue ? ride : leftCue && !rideCue ? left : unsure).push(...found);
  }
  if (!left.length && unsure.length) left.push(unsure.shift());
  if (!ride.length && unsure.length) ride.push(unsure.shift());
  if (left.length) v.minsLeft = Math.min(600, left[0]);
  if (ride.length) v.usualRide = Math.max(1, Math.min(300, ride[0]));
  // A clock time such as "by 9am" becomes minutes left, counted from the time now.
  const clock = text.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m|p\.?m)\b/);
  if (clock && v.minsLeft === undefined && isFinite(nowHour)) {
    const due = (+clock[1] % 12) + (clock[3][0] === 'p' ? 12 : 0) + (+(clock[2] || 0)) / 60;
    const mins = Math.round((((due - nowHour) % 24) + 24) % 24 * 60);
    if (mins > 0 && mins <= 600) v.minsLeft = mins;
  }

  const understood = [];
  if (v.weather) understood.push(WEATHER[v.weather].label);
  if (v.jeep) understood.push(JEEP_LABEL[v.jeep]);
  if (v.minsLeft !== undefined) understood.push(v.minsLeft + ' min left');
  if (v.usualRide !== undefined) understood.push(v.usualRide + ' min ride');
  if (v.importance) understood.push(IMPORTANCE_LABEL[v.importance]);
  tags.forEach(t => understood.push(TAGS[t].label));
  return { values: v, understood };
}

// Which language the passenger wrote in: en, tl, mix, or null when the message gives no clue.
function detectLanguage(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  const tl = (t.match(/\b(na|ang|ako|ko|lang|nalang|yung|pa|may|wala|walang|hindi|di|umuulan|ulan|puno|sabit|upuan|maluwag|pila|ba|ka|mga|sa|ng|naman|po|kasi|pero|tapos|minuto|oras|biyahe|byahe|sakay|hintay|bawal)\b/g) || []).length;
  const en = (t.match(/\b(the|is|it's|its|i|i'm|have|has|and|are|there|there's|to|be|in|my|of|left|raining|rain|full|seats?|late|ride|wait|should|can't|cannot|not|no|hour)\b/g) || []).length;
  return tl && en ? 'mix' : tl ? 'tl' : en ? 'en' : null;
}
// Puts the prediction into one or two short sentences. Uses only the model's own numbers.
function writeReply(d, input, lang) {
  const pc = p => Math.max(1, Math.min(99, Math.round(p * 100)));
  const r = pc(d.pRide), w = pc(d.pWait), next = Math.max(1, Math.round(d.waitMean)), spare = Math.round(d.slack);
  const rainy = WEATHER[input.weather].rainy;
  let out;
  if (d.ride && w - r < 3 && spare >= 0) out = {
    en: 'Ride this one. You have about ' + spare + ' spare minutes either way, so there is no reason to wait ' + next + ' minutes for the next jeep.',
    tl: 'Sumakay ka na. May mga ' + spare + ' minuto ka pang palugit alinman ang piliin mo, kaya hindi na kailangang maghintay ng ' + next + ' minuto.',
    mix: 'Sakay na. May mga ' + spare + ' minutes ka pang extra either way, so no need maghintay ng ' + next + ' minutes.'
  };
  else if (d.ride) out = {
    en: 'Ride this one. The next jeep is about ' + next + ' minutes away, and waiting puts your chance of being late at ' + w + '%, against ' + r + '% if you board now.',
    tl: 'Sumakay ka na. Mga ' + next + ' minuto pa ang susunod na jeep, at ' + w + '% ang tsansang ma-late ka kung maghihintay ka, kumpara sa ' + r + '% kung sasakay ka na.',
    mix: 'Sakay na. Mga ' + next + ' minutes pa yung next jeep, at ' + w + '% ang chance na ma-late ka kung maghihintay ka, ' + r + '% lang kung sasakay ka na.'
  };
  else out = {
    en: 'Wait for the next one. It should come in about ' + next + ' minutes, and your chance of being late would still be only ' + w + '%.',
    tl: 'Maghintay ka muna. Mga ' + next + ' minuto lang ang susunod na jeep, at ' + w + '% lang ang tsansang ma-late ka kahit maghintay ka.',
    mix: 'Hintay ka muna. Mga ' + next + ' minutes lang yung next jeep, at ' + w + '% lang ang chance na ma-late ka.'
  };
  let text = out[lang] || out.en;
  if (spare < 0) text += ({ en: ' You are already about ' + (-spare) + ' minutes short.', tl: ' Kulang ka na ng mga ' + (-spare) + ' minuto.', mix: ' Kulang ka na ng mga ' + (-spare) + ' minutes.' })[lang];
  if (input.jeep === 'sabit') text += ({
    en: ' Hanging on the back is risky' + (rainy ? ', more so on a wet step' : '') + ', so skip it if you have any doubt.',
    tl: ' Delikado ang sumabit' + (rainy ? ', lalo na at basa ang estribo' : '') + ', kaya huwag na kung alanganin ka.',
    mix: ' Delikado ang sabit' + (rainy ? ', lalo na pag basa' : '') + ', so huwag na kung alanganin ka.'
  })[lang];
  else if (input.jeep === 'seat' && d.ride) text += ({ en: ' It has seats, so there is nothing to gain by waiting.', tl: ' May upuan pa naman, kaya walang dahilan para maghintay.', mix: ' May seats pa naman, so walang reason para maghintay.' })[lang];
  return text;
}
/*MODEL-END*/

if (typeof module !== "undefined") module.exports = { decide, readSentence, writeReply, detectLanguage, predictWait, predictRide, trainLate, predictLate, trainedFor, WEATHER, TAGS, TRAIN_MIN, FACTORS };
