// Travel questions: embed with e5 -> search the bundled KB -> Qwen explains the top 3. All on the phone.

import {
  attribution,
  buildMessages,
  detectDestinations,
  loadKb,
  looksLikeTravelQuestion,
  polishAnswer,
  queryText,
  search,
  withNudge,
} from '../core/kb/retrieve';
import { getEmbedder, getExplainer } from './models';

// kb.json is ~14 MB, so it's parsed on first use rather than at app start.
let index = null;
const getIndex = () => {
  if (!index) index = loadKb(require('../../data/v2/kb.json'));
  return index;
};

export const mentionsDestination = (text) => detectDestinations(getIndex(), text).length > 0;
export const isTravelQuestion = (text) => looksLikeTravelQuestion(getIndex(), text);

let explainer = null;

/**
 * @param onUpdate called with the answer text so far, for streaming into the chat bubble
 * @returns {{ text, sources, hits, destinations, categories }}
 */
export async function askGuide(question, onUpdate) {
  const kb = getIndex();

  onUpdate?.('Searching the travel guide…');
  const embedder = await getEmbedder();
  const { embedding } = await embedder.embedding(queryText(question));
  const norm = Math.hypot(...embedding);
  const qvec = Float32Array.from(embedding, (x) => x / norm);
  const result = search(kb, question, qvec);

  onUpdate?.('Writing an answer…');
  explainer = await getExplainer();
  let text = '';
  const res = await explainer.completion(
    { messages: buildMessages(question, result.hits), n_predict: 200, temperature: 0.5 },
    ({ token }) => {
      text += token;
      onUpdate?.(polishAnswer(text));
    },
  );
  const answer = withNudge(polishAnswer((res.text || text).trim()), result.categories, question);
  return { ...result, text: answer, sources: attribution(result.hits) };
}

export const stopGuide = () => explainer?.stopCompletion();
