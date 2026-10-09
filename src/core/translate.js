// Placeholder translator: phrasebook lookup only.
// Swap the body for the on-device model later; keep the signature.

import { PHRASEBOOK } from '../data/phrasebook';

// Ignore case, punctuation and extra spaces so typed "para po" matches "Para po!".
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[!?.,…'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @returns {string|null} translated text, or null if it can't be translated offline yet
 */
export function translate(text, from, to) {
  if (from === to) return text;
  const needle = normalize(text);
  const entry = PHRASEBOOK.find((p) => p[from] && normalize(p[from]) === needle);
  return entry?.[to] ?? null;
}

// Stand-in for speech-to-text until a real recognizer is wired in.
export const DEMO_UTTERANCE = 'Magkano po ang pamasahe papuntang Cubao?';
