# Philippines Travel Knowledge Base — Handoff

October 10, 2026

## Overview

We have a clean, Philippines-only travel knowledge base in three JSON files, built from the English Wikivoyage dump. The next step is to embed it and load it into Postgres; work is paused here.

The goal is a React Native chatbot that answers questions like "what should I do in Cebu for 3 days?" by pointing users to the obvious, well-known attractions. It is not an itinerary planner.

The design is retrieval-augmented generation (RAG). Facts live in the knowledge base, not in the model. For each question we retrieve the top 3 matching chunks and pass them to a small language model, which turns them into a friendly answer with citations.

Status:

- Done: extracted 622 destinations, 8,789 listings and 11,667 retrieval chunks to JSON.
- Done: tested a Postgres + pgvector schema, loader and retrieval query in a sandbox, using stand-in embeddings.
- Next: run real embeddings, load into the local Postgres, and test answer quality.

## The datasets

Three files, about 15 MB in total. Only `chunks.jsonl` is searched; the other two are reference data the app and prompt can draw on.

| File | Records | Size | Format | Used for |
| --- | --- | --- | --- | --- |
| `destinations.json` | 622 | 0.4 MB | JSON array | City and region pages: hierarchy, coordinates, summary. Destination detection and filtering |
| `listings.json` | 8,789 | 5.9 MB | JSON array | Every structured place (see, do, eat, drink, buy, sleep). Map pins and detail screens |
| `chunks.jsonl` | 11,667 | 9.0 MB | One JSON object per line | Retrieval units. Embedded and searched; the top 3 go to the model |

### destinations.json

| Field | Example | Notes |
| --- | --- | --- |
| `id` | `cebu-city` | Slug of the page title; primary key |
| `name` | `Cebu City` | Page title; disambiguated names keep parentheses, e.g. `Talisay (Cebu)` |
| `type` | `city` | city, region, ruralarea, district, park, diveguide, airport |
| `article_status` | `guide` | outline < usable < guide < star. Outline pages are sparse |
| `path` | `["Visayas", "Cebu Province", "Metro Cebu"]` | Ancestors below Philippines, top-down |
| `island_group` | `Visayas` | Luzon, Visayas, Mindanao or Palawan |
| `lat`, `lng` | `10.3093`, `123.8931` | Missing on 144 pages |
| `summary` | First paragraph of the page | Up to 800 characters |
| `listing_counts` | `{"see": 17, "do": 3, ...}` | Quick coverage check |
| `source_url`, `last_edited` | Wikivoyage URL, ISO timestamp | Attribution and freshness |

### listings.json

| Field | Example | Notes |
| --- | --- | --- |
| `id` | `cebu-city::magellan-s-cross` | Same id as its chunk |
| `destination_id` | `cebu-city` | Joins to destinations |
| `category` | `see` | see, do, eat, drink, buy, sleep |
| `subsection` | `Shrines and historical landmarks` | Wikivoyage sub-heading, may be null |
| `name`, `alt_name` | `Magellan's Cross` | |
| `description` | Plain text | Wiki markup removed; prices like ₱75 kept |
| `address`, `directions`, `hours`, `price` | | Often null |
| `lat`, `lng` | `10.29359`, `123.90195` | Present on 82% of listings |
| `url`, `wikidata` | `Q772656` | Wikidata ID links to images and more facts |

### chunks.jsonl

| Field | Example | Notes |
| --- | --- | --- |
| `id` | `cebu-city::magellan-s-cross` | Unique |
| `destination_id`, `destination` | `cebu-city`, `Cebu City` | |
| `kind` | `listing` | overview (622), listing (8,789), section (2,256) |
| `category` | `see` | overview, understand, see, do, eat, drink, buy, sleep |
| `name` | Listing name or section label | e.g. `See / Natural sites` |
| `text` | What the model reads | Max ~1,500 characters |
| `embed_text` | What gets embedded | `text` prefixed with name, category and location |
| `lat`, `lng` | | Falls back to the destination's coordinates |
| `source_url` | Wikivoyage page | |

The `embed_text` prefix matters. "Magellan's Cross — see in Cebu City, Metro Cebu, Cebu Province, Philippines. An octagonal building…" lets a question about Cebu match the chunk even when the description never names the city.

## How the files relate

Everything hangs off `destinations.id`. Listings and chunks both carry `destination_id`, and a listing's chunk shares the listing's `id`.

- `chunks.destination_id` → `destinations.id`: every chunk belongs to one destination.
- `listings.destination_id` → `destinations.id`: every listing belongs to one destination.
- `chunks.id` = `listings.id` when `kind = listing`: after retrieval, join back to the listing for structured fields (hours, price, coordinates) without parsing text.
- `destinations.path`: lets a region query include its children. A destination is "inside Bohol" when its `name` is `Bohol` or `Bohol` is in its `path`.

Not every chunk has a listing. Overview chunks come from the page's first paragraph, and section chunks come from prose outside any listing. Section chunks carry most of the content for the 437 outline pages.

## Retrieval flow

A question becomes three chunks in five steps. Two cheap filters (destination and intent) narrow the search before the vector comparison, which keeps results on-topic and in the right place.

1. **Detect the destination.** Match destination names against the question, longest first, so "Cebu City" wins over "Cebu". Strip parenthetical disambiguators first (`Talisay (Cebu)` → `talisay`). No match → search all destinations.
2. **Detect the intent.** Keyword patterns pick categories. Default is sightseeing: `see`, `do`, `overview`. Food, nightlife, shopping and hotels are added only when asked:
   - eat: eat, food, restaurant, kain, kumain, masarap, lechon
   - drink: bar, nightlife, club, inuman, beer
   - buy: shop, mall, market, pasalubong, souvenir
   - sleep: stay, hotel, hostel, resort, tulog
3. **Embed the question** with the same model used for the chunks: `intfloat/multilingual-e5-small` (384 dimensions). e5 needs prefixes: `query: ` for questions and `passage: ` for chunks. Mixing them up quietly ruins ranking.
4. **Search.** Cosine similarity over chunks, filtered by category and destination (including children), top 3.
5. **Join back** (optional). For `kind = listing` results, fetch the listing row for hours, price and coordinates to show in the app.

The search query, with pgvector:

```sql
SELECT c.name, c.category, c.text, c.lat, c.lng, c.source_url,
       d.name AS destination,
       1 - (c.embedding <=> $1::vector) AS score
FROM chunks c
JOIN destinations d ON d.id = c.destination_id
WHERE c.category = ANY($2)                      -- e.g. {see,do,overview}
  AND ($3::text IS NULL OR d.name = $3 OR $3 = ANY(d.path))
ORDER BY c.embedding <=> $1::vector
LIMIT 3;
```

Two cases need handling before step 1 in a real conversation: misspellings ("Sebu") and follow-ups with no place name ("what about there?"). The planned fix is a short rewrite step that turns the latest message plus chat history into a standalone question.

## Feeding the final model

The model only rewrites what retrieval found; it never supplies facts of its own. The system prompt pins that down, and each source is numbered so the answer can cite it.

System prompt:

```
You are a friendly Philippine travel guide.
Answer using ONLY the numbered sources provided. If they don't cover the question, say so.
Recommend the obvious, well-known things first. Group nearby places together when the user
mentions a number of days, but do not write a timed itinerary.
Mention prices or hours only if a source gives them. Cite sources like [1], [2].
Reply in the user's language (English, Tagalog or Taglish).
```

User message, built from the top 3 chunks:

```
Sources:

[1] Magellan's Cross (see, Cebu City)
An octagonal building decorated with murals containing a large wooden cross...
price: Free; address: Plaza Sugbo, off Magallanes St
Map: https://maps.google.com/?q=10.29359,123.90195

[2] ...

Question: what should I do in Cebu City for 3 days?
```

Notes:

- Top 3 is the starting point. For "3 days" questions, 5 to 8 gives the model enough places to group by area; test both.
- Coordinates in the sources let the model group nearby places, and let the app render map pins next to the answer.
- Candidate models: Qwen3 4B or Gemma 3 4B. Try prompting alone first; fine-tune with QLoRA only if tone or format is inconsistent.
- Return the `source_url` list alongside the answer so the app can show attribution.

## Storage options

Recommended: Postgres with pgvector on the local database. At 11,667 chunks × 384 floats (about 18 MB of vectors), all three options are fast; the difference is how much code you write.

| Option | Search runs in | Setup | Trade-off |
| --- | --- | --- | --- |
| Postgres + pgvector | One SQL query | `CREATE EXTENSION vector;` | Filter and rank in one place. Needs the extension installed locally |
| Plain Postgres, `real[]` column | App server memory | None | Load all rows at startup, dot product in code. Restart after re-indexing |
| On-device in React Native | The phone | Ship vectors as a `Float32Array` file | Works offline, no hosting cost. Adds ~20 MB to the app; the question still needs embedding |

The Postgres schema has three tables mirroring the JSON files: `destinations`, `listings`, and `chunks` with an `embedding vector(384)` column. Index `chunks (destination_id, category)`. Skip the HNSW vector index until the table reaches hundreds of thousands of rows; exact search is a few milliseconds at this size.

Embedding all chunks with `multilingual-e5-small` takes a few minutes on a laptop CPU. Embed `embed_text` with the `passage: ` prefix and normalize the vectors, so cosine similarity equals the dot product.

## React Native integration

For the MVP, keep the app thin: it sends the question to one backend endpoint and renders what comes back. Embedding, search and the model all run on the server.

1. The app posts `{ question, history }` to `POST /ask`.
2. The server rewrites follow-ups into a standalone question, then runs the retrieval flow.
3. The server sends the system prompt and sources to the model.
4. The server returns the answer plus structured data the app can render without parsing text.

Suggested response shape:

```json
{
  "answer": "Start in the old Colon district... [1] [2]",
  "destination": "Cebu City",
  "places": [
    { "id": "cebu-city::magellan-s-cross", "name": "Magellan's Cross",
      "category": "see", "lat": 10.29359, "lng": 123.90195, "price": "Free" }
  ],
  "sources": ["https://en.wikivoyage.org/wiki/Cebu_City"]
}
```

`places` drives map pins and detail cards, filled by joining retrieved chunk ids to `listings`. `sources` drives the attribution line under each answer.

Later, retrieval can move on-device for offline use: bundle the vectors and metadata, embed questions with an ONNX build of the e5 model via `onnxruntime-react-native`, and run the dot product in JavaScript. Only the model call would then need the network, or none at all with a small on-device model via `llama.rn`.

## Regenerating the data

The JSON can be rebuilt from any newer Wikivoyage dump in about a minute with two scripts, `pass1.py` and `extract_ph.py`. Wikivoyage publishes new dumps roughly twice a month at dumps.wikimedia.org/enwikivoyage.

1. Download `enwikivoyage-latest-pages-articles.xml.bz2` (about 130 MB).
2. `pip install lxml mwparserfromhell`
3. `python pass1.py enwikivoyage-latest-pages-articles.xml.bz2`: streams the dump into a local SQLite file, about 30 seconds.
4. `python extract_ph.py`: filters to the Philippines and writes the three JSON files to `out/`.
5. Re-embed only chunks whose `id` is new or whose `embed_text` changed.

What the extractor does: it keeps pages whose `{{IsPartOf}}` chain reaches "Philippines", following redirects. It parses listing templates into fields, converts wiki markup to plain text (keeping ₱ amounts and link labels, dropping images and references), and splits prose into chunks of at most 1,500 characters on paragraph and sentence boundaries.

## Known gaps and next steps

The biggest limitation is uneven coverage, which mirrors Wikivoyage itself.

| Gap | Size | Mitigation |
| --- | --- | --- |
| Luzon-heavy coverage | See/do chunks: Luzon ~2,600, Visayas ~560, Mindanao ~245, Palawan ~85 | Add OpenStreetMap and Wikidata attractions; hand-write entries for priority destinations |
| Sparse outline pages | 437 of 622 destinations | Rely on section chunks; flag low-coverage answers in the UI |
| Listings without coordinates | 18% of listings | Fill from Wikidata via the `wikidata` field, or OSM by name match |
| Destinations without coordinates | 144 of 622 | Inherit from parent or a child destination |
| Exact-name destination detection | Misses typos and follow-ups | Fuzzy matching plus a question-rewrite step |
| Stale information | Closures and prices change | Regenerate monthly; show `last_edited` |

Next steps:

- [ ] Install pgvector on the local Postgres and create the three tables
- [ ] Load the JSON files and embed all chunks with `multilingual-e5-small`
- [ ] Write 30 to 50 test questions across Luzon, Visayas and Mindanao, in English and Tagalog
- [ ] Check retrieval alone: is a correct, relevant chunk in the top 3?
- [ ] Pick the final model and test the prompt end to end
- [ ] Build the `POST /ask` endpoint and the React Native chat screen
- [ ] Add fuzzy destination matching and the follow-up rewrite step

## License and attribution

All text comes from Wikivoyage and is licensed CC BY-SA 4.0, so the app must credit it. Every record keeps its `source_url` for this.

- Show "Source: Wikivoyage" with a link to the page under each answer, and an attribution note on an About screen.
- Text redistributed in the app stays under CC BY-SA. Model answers built from the sources may count as adaptations, so the safe default is to treat them the same way.
- Data added later from OpenStreetMap (ODbL) or Wikidata (CC0) has its own terms; track the source per record.
