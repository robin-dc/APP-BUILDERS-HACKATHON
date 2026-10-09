// The two on-device models, bundled into the app from models/ (see metro.config.js).
// Needs a dev build: in Expo Go llama.rn has no native module and loading throws.

import { Asset } from 'expo-asset';
import { initLlama } from 'llama.rn';

const EMBEDDER = require('../../models/multilingual-e5-small-q8_0.gguf');
const EXPLAINER = require('../../models/qwen2.5-0.5b-instruct-q4_k_m.gguf');

// llama.rn needs a file path; expo-asset copies the bundled file out of the app package once.
async function localPath(moduleId) {
  const asset = await Asset.fromModule(moduleId).downloadAsync();
  return asset.localUri.replace('file://', '');
}

function lazyContext(moduleId, params) {
  let promise = null;
  return () => {
    if (!promise) {
      promise = localPath(moduleId).then((model) => initLlama({ model, ...params }));
      // Let a failed load be retried on the next call.
      promise.catch(() => (promise = null));
    }
    return promise;
  };
}

/** multilingual-e5-small: must match the model scripts/build-kb.mjs embedded the KB with. */
export const getEmbedder = lazyContext(EMBEDDER, { embedding: true, n_ctx: 512 });

/** Qwen2.5-0.5B-Instruct: turns the top results into a short answer. */
export const getExplainer = lazyContext(EXPLAINER, { n_ctx: 2048 });
