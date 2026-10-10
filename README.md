# Travel Ducky

Ducky is a travel companion for visitors and travelers who want to make the most of their time in the Philippines. Ask Ducky what's worth seeing, how to get there, and how to spend your days, and get clear, reliable recommendations. Its built-in voice translator helps you talk with locals wherever you go.

The travel guide runs entirely on the phone: the knowledge base and both AI models ship inside the app, so recommendations keep working in airplane mode.

## What it does

| Feature | How it works |
| --- | --- |
| **Travel guide chat** | Ask about places, food, where to stay and how to get around. Ducky searches a built-in Philippine travel knowledge base (622 destinations, 14,157 passages from Wikivoyage) and an on-device language model turns the top 3 results into a short, friendly answer. |
| **Sakay o hintay** | Tell Ducky what you see at the jeepney stop (weather, how full the jeep is, minutes left) and it suggests whether to ride now or wait for the next one. Rule-based, instant, offline. |
| **Voice translator** | English ↔ Tagalog with speech input, Google ML Kit on-device translation and spoken output. See [Translator notes](#translator-notes). |

## Tech stack

| Layer | Tools |
| --- | --- |
| App | React Native 0.86, Expo SDK 57, React 19, JavaScript |
| Styling | Tailwind CSS via NativeWind v4 |
| On-device AI | [`llama.rn`](https://github.com/mybigday/llama.rn) (llama.cpp for React Native) running two GGUF models |
| Embedding model | `multilingual-e5-small` (Q8_0, 132 MB, 384 dimensions): turns questions into vectors |
| Answer model | `Qwen2.5-0.5B-Instruct` (Q4_K_M, 491 MB): writes the reply from the top 3 search results |
| Knowledge base | `data/v2/kb.json` (14.4 MB): Wikivoyage chunks plus their int8 embeddings, searched in plain JS |
| Translator | `@react-native-ml-kit/translate-text`, `expo-speech-recognition`, `expo-speech` |
| Builds | EAS Build (Android APK) |
| Laptop tooling | `node-llama-cpp` (same llama.cpp engine) for building the knowledge base, testing, and serving the models to the web build |

### How a travel question is answered

1. The question is matched to a destination ("Cebu City", or every town inside "Cavite") and an intent (sights, food, stay, getting there, getting around).
2. `multilingual-e5-small` embeds the question.
3. The matching chunks in `kb.json` are ranked by similarity, and the top 3 are kept.
4. `Qwen2.5-0.5B-Instruct` rewrites those 3 chunks into a short answer. It is told to use only facts from them.

Code: `src/core/kb/retrieve.js` (search and prompt), `src/ai/travelGuide.js` (pipeline), `src/ai/models.js` (model loading).

## Models (required)

The models are not in git (they are too large). Download both files and put them in a `models/` folder at the project root, with these exact names:

| File | Size |
| --- | --- |
| `models/multilingual-e5-small-q8_0.gguf` | 132 MB |
| `models/qwen2.5-0.5b-instruct-q4_k_m.gguf` | 491 MB |

**Download: [MODELS_DRIVE_LINK]**

Original sources, if the link is down:

```bash
mkdir -p models
curl -L --fail -o models/multilingual-e5-small-q8_0.gguf \
  https://huggingface.co/TwinSunsLLC/multilingual-e5-small-gguf/resolve/main/multilingual-e5-small-q8_0.gguf
curl -L --fail -o models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
```

Use the e5 file above, not other conversions: some (for example `cstr/multilingual-e5-small-GGUF`) lack a field that current llama.cpp requires and fail to load.

## Run on localhost (web)

The browser can't run `llama.rn`, so the web build sends its two model calls to a small server on your machine that runs the same GGUF files. Everything else (search, chat, UI) runs in the browser.

Requirements: Node.js (developed on v26) and npm, plus the two models in `models/`.

```bash
npm install

# Terminal 1: serves the models on http://localhost:8787
npm run dev:ai

# Terminal 2: the app
npx expo start --web
```

Wait for terminal 1 to print `dev AI server on http://localhost:8787`, then open the web app and try a starter prompt such as "I'm at Tagaytay, what's fun to do here?". The jeepney assistant works without the server. The translator needs a phone build.

To test the travel guide from the terminal without the app:

```bash
npm run ask -- "I happen to be at Baguio, how would I get around?"
npm run ask -- --no-llm "where to eat in Iloilo City?"   # search results only
```

## Run on a phone

The app uses native modules (`llama.rn`, ML Kit, speech recognition), so it needs its own build. **Expo Go will not work.** Builds are made in the cloud with EAS, so Android Studio and Xcode aren't required.

```bash
npx eas-cli@latest login

# Standalone APK: models and knowledge base inside, works fully offline (~775 MB)
npx eas-cli@latest build --profile preview --platform android

# Development build: loads code from your laptop with live reload
npx eas-cli@latest build --profile development --platform android
npx expo start   # then open the installed development build, phone on the same network
```

Notes:

- **First travel question is slow.** On first use the app copies the models out of the APK. Ask one question before demoing.
- **Development builds don't contain the models.** They download them from your laptop the first time (about 620 MB), so keep the phone and laptop on the same network. A phone hotspot avoids venue Wi-Fi that blocks device-to-device traffic.
- **The two builds can't be installed side by side.** Uninstall one before installing the other.
- **iOS** needs a paid Apple Developer account for device builds.

## Translator notes

Speech recognition and voices depend on the device and its speech provider, and recognition is not guaranteed to work offline. ML Kit downloads its translation models the first time they're needed, so open the translator once while online. Translations are attributed to [Google Translate](https://translate.google.com/). The React Native ML Kit wrapper is alpha and untested with the New Architecture; ML Kit translation is meant for casual use, not high-stakes translation.

## Rebuilding the knowledge base

`data/v2/kb.json` is committed, so this is only needed when the source data changes.

1. **Source data:** `data/destinations.json`, `data/listings.json` and `data/chunks.jsonl` are extracted from the English Wikivoyage dump (Wikimedia dumps, October 2026): filtered to the Philippines, cleaned of wiki markup and split into chunks. Details in `city_kb_handoff.md`.
2. **Embeddings:** run `npm run build:kb` (about 90 seconds on a laptop). It embeds every chunk with `multilingual-e5-small` and writes `data/v2/kb.json`.

The app must embed questions with the same e5 file that built the knowledge base, so rebuild `kb.json` whenever the model or the chunks change.

## Project structure

```
App.js                  app shell
src/screens/            ChatScreen (guide + sakay o hintay), TranslateScreen
src/components/         chat bubbles, chips, translator UI
src/core/kb/retrieve.js knowledge-base search and answer prompt (plain JS, shared with scripts)
src/core/model.js       sakay o hintay prediction engine
src/core/sakayChat.js   sakay o hintay conversation flow
src/ai/                 model loading (llama.rn on phones, localhost server on web) and the guide pipeline
scripts/                build-kb.mjs, ask.mjs, dev-ai-server.mjs
data/                   source JSONs and data/v2/kb.json
models/                 GGUF models (not in git, see above)
```

## Data and licenses

- Travel content © Wikivoyage contributors, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Every chunk keeps its `source_url` for attribution.
- `multilingual-e5-small`: MIT. `Qwen2.5-0.5B-Instruct`: Apache 2.0.
- Fares, schedules and openings come from volunteer-written guides and can be out of date. Treat them as estimates.

## Technical disclosures

Tools, services and resources used to build this project:

| Used | For |
| --- | --- |
| Claude Code | AI coding assistant |
| GitHub Copilot | AI coding assistant |
| Devin AI | AI software engineering agent |
| Google Colab | Notebook environment |
| React Native (Expo) | Mobile app framework |
| Tailwind CSS (NativeWind) | Styling |
| GitHub | Source control and collaboration |
| Wikimedia dumps (English Wikivoyage) | Travel knowledge base source data |
| DICT | Department of Information and Communications Technology |
| Coffee | Fuel |
