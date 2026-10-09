# Biyahe Buddy

Local-first AI commuter and travel companion for the Philippines. Working name.

**Hackathon prompt:** build an AI product that stays useful when the cloud disappears.
**Team:** 4 people, about 12 hours to a working prototype.

## Established decisions

| Decision | Choice |
| --- | --- |
| Platform | **React Native app, app-first** (Expo) |
| Styling | **Tailwind** via NativeWind v4 |
| Language | **JavaScript** (no TypeScript) |
| AI | Runs on the device; the cloud is an optional last fallback, never the core |

> The original plan was a PWA (Vite, WebLLM, Transformers.js). We are now building a native app, so the
> browser-specific pieces (Web Workers, WebGPU, Cache Storage, service workers) map to native
> equivalents. See [On-device AI stack](#on-device-ai-stack-to-verify).

## Concept

An app that helps commuters and visitors decide how to get somewhere, ride the MRT/LRT, understand
local travel context, and communicate. All AI runs on the user's own device. Airplane mode on, and the
translator and travel assistant still work.

## Core story (never cut)

**Plan + Rail + Translate.** The Guide chat is the first thing to cut if behind.

## Key design pattern: LLM for language, code for facts

Small models hallucinate fares and routes, so the local LLM never invents transit data.

User types: *"cheapest way from Ayala to Cubao, I have a big bag"*

1. (Optional, stretch) Speech-to-text converts voice to text.
2. Local LLM extracts **intent only**, as JSON: `from`, `to`, `priority`, `constraints`.
3. Validate the JSON. On failure, retry once, then fall back to a keyword parser for origin/destination.
4. A **deterministic routing engine** (station graph + fare table + pathfinding) computes the real options.
5. Local LLM explains the result in friendly English or Filipino, **using only the computed data passed
   into the prompt** (or a template as a fallback).

The Guide uses the same pattern: curated tips JSON as context. Simple RAG: keyword-match, then inject
the top 3 tips into the prompt.

**Bad-premise handling (demo moment):** the app should catch wrong input rather than agree. Example:
"southbound from Taft to Ortigas". Taft Avenue is believed to be the southern terminus of MRT-3 and
Ortigas is north of it, so the app should say Taft is the end of the line and Ortigas is northbound.
**Verify against the official line map before hardcoding.**

## Features

### Must-have
- Four sections: **Plan, Ride, Guide, Translate**
- Commuter decision with 2-3 options (rail, bus/jeep, ride-hail) and a "best for you" pick; a
  Fastest/Cheapest toggle changes the recommendation
- Rail buddy across **LRT-1, LRT-2, MRT-3** with transfers, direction, stop count and fare
- Local AI translator with pronunciation hints and quick-phrase chips
- Offline mode: rail data, phrasebook and the AI model all working in airplane mode
- Status badge in the UI ("On-device AI: ready") so judges can see it is local

### Should-have
- Guide chat grounded in curated tips
- Saved trips
- Geolocation to prefill origin (GPS works offline)
- Voice input (stretch)

### Cut
- Real-time train arrivals or traffic
- User accounts and payments
- Turn-by-turn maps and offline map tiles

## On-device AI stack (to verify)

Starting points from the earlier research. **Verify current library support, model IDs, sizes and
licenses before committing.** Native modules need a custom dev build, so they won't run in Expo Go.

| Capability | Candidate |
| --- | --- |
| Local LLM (intent + guide) | `llama.rn` or `react-native-executorch`, with a ~0.5-1.5B 4-bit model |
| Speech-to-text (stretch) | `whisper.rn` |
| Translation | Google ML Kit on-device translation via a community wrapper. Tagalog is likely supported; Cebuano and Ilocano likely are not, so check the language list |
| Speech output | Native OS TTS (Filipino voice availability varies by device) |
| Saved data | AsyncStorage or SQLite |
| Location | `expo-location` |

**Known risk:** the strongest multi-language offline translation option (NLLB via Transformers.js) is
easy in a browser and hard in React Native. Plan to ship a simpler translator plus the static phrasebook.

## Fallback ladder

1. Model downloaded and device capable: local LLM + local translation
2. Smaller model or slower path on weaker devices
3. Model not loaded: static phrasebook + rules-based planner
4. Optional, last: cloud endpoint if online and everything above fails

## Project structure

```
App.js            app shell and tab navigation
src/screens/      Plan, Ride, Guide, Translate
src/components/   shared UI
src/core/         framework-agnostic logic: station graph, fares, pathfinding, intent schema, prompts, phrasebook
docs/             project documentation
```

Keep all "code for facts" logic in `src/core` as plain JavaScript with no React imports, so it is easy
to unit test and reuse.

## Team split

| Person | Responsibility |
| --- | --- |
| **A: Frontend** | App shell and UI, model download/progress UI, AI status badge, streaming chat UI |
| **B: Routing/logic** | Station graph, pathfinding, fares, commuter scoring. Exposes `planTrip(intent)` and a facts object the explainer prompt uses |
| **C: AI** | Entire local AI layer: model loading and storage, translator, intent extraction, guide chat. Cloud proxy is optional and last |
| **D: Content, design, pitch** | Curated tips JSON, demo phrasebook, station data entry, branding, slides, demo rehearsal |

**Agree in hour 0-1:** data shapes for `Intent`, the `PlanResult`/facts object, and the interface between
UI and the AI layer. A and C build against this from the start.

## Timeline (12 hours)

| When | Focus |
| --- | --- |
| Hour 0-1.5 | Align scope and data shapes, set up repo. **AI spike (go/no-go):** C gets a model loading and answering on a real device. If unworkable, drop down the fallback ladder now |
| Hour 1.5-5 | Parallel build: intent extraction (JSON-only prompts, safe parse + retry), translator UI, RAG guide, routing module, station data |
| Hour 5-8 | Integrate UI with routing and local AI. First full end-to-end run of the demo path. By hour 6, test the exact demo device |
| Hour 8-9 | **Feature freeze** |
| Hour 9-11 | Offline testing on the demo device, bug fixing, polish, loading/error states |
| Hour 11-12 | Rehearse the demo twice, record a backup screen recording, prepare Q&A |

## Demo script (about 3 minutes)

1. **Problem (20s):** a tourist lands and doesn't know whether to take a Grab, a bus, or the train.
2. **Plan (40s):** type a natural-language request, get options and an explanation; flip
   Fastest/Cheapest and watch the recommendation change.
3. **Ride (30s):** rail buddy step-by-step with transfers and fare. Show the bad-premise catch if ready.
4. **Translate (30s):** translate a phrase with pronunciation shown.
5. **Prove it's local (40s):** airplane mode on, run the translator and assistant again.
6. **Close (20s):** impact and next steps (live data, more cities, more languages).

## Practical constraints

- **Model download:** hundreds of MB to ~1 GB. Download once on good Wi-Fi, store on device, show a
  progress bar and a "Download offline AI pack" button. Pre-load on the demo device before going on
  stage. Never rely on venue Wi-Fi.
- **Devices:** small devices can run out of memory. Test the exact demo device by hour 6.
- **Speed:** expect a few seconds per response. Stream tokens, keep prompts and outputs short.
- **Quality:** Tagalog translation is decent, not perfect. Pair it with the phrasebook so demo phrases
  are guaranteed correct.
- **Licensing:** check each model's license before use.
- **Malformed JSON from small models:** strict prompt, defensive parsing, keyword-parser fallback.

## Data accuracy

Transit data is the real work and the biggest credibility risk.

- Collect fares, travel times, station order and transfer rules from **official sources** (DOTr and the
  operators). Fares have been revised before; don't trust memory.
- Label fares and times as **estimates** in the UI.
- Show an "About data" line with a **last updated** date.
- Real-time disruptions can't be known offline; say so in the UI.
- Verify station order and terminus per line (including Taft/EDSA, Cubao and other transfer points)
  before hardcoding.

## Risks

- Model download fails on venue Wi-Fi: pre-load the model and keep a backup recording.
- Malformed JSON from a small model: see the fallback in the design pattern above.
- Device compatibility: test the exact demo device by hour 6, not hour 11.
- Scope creep: the Guide chat goes first if behind.
- Transit data accuracy: see Data accuracy.

## Open items

- [ ] Agree and commit shared data shapes (`Intent`, facts object, AI layer interface)
- [ ] Pick exact LLM and translation model/library; confirm sizes and licenses
- [ ] Confirm the demo device; run the download-then-airplane-mode test early
- [ ] Source official fare matrices and station lists for LRT-1, LRT-2, MRT-3
- [ ] Decide the pitch angle: commuter convenience vs. higher stakes (accessibility, disaster resilience, tourists)
- [ ] Decide whether bus/jeep and ride-hail use rough estimates or are simplified to rail-first
- [ ] Draft intent-extraction prompts and JSON schema
- [ ] Record the backup demo video
