# Biyahe Buddy

Local-first AI commuter and travel companion for the Philippines. React Native (Expo), Tailwind (NativeWind), JavaScript.

Full project doc: [docs/PROJECT.md](docs/PROJECT.md)

## Run

```bash
npm install
npx expo start   # press i (iOS), a (Android), or scan the QR code with Expo Go
```

Native AI modules (LLM, speech) will need a custom dev build instead of Expo Go.

## Translator

The Translate tab supports English ↔ Tagalog phrase translation with device speech
recognition, Google ML Kit on-device translation, and system text-to-speech. Speech
recognition availability and voices depend on the device and its speech provider;
recognition is not guaranteed to work offline. Translation models are downloaded when
first needed, and translations are attributed to
[Google Translate](https://translate.google.com/).

After installing native modules or changing the speech-recognition config plugin,
rebuild the native app (`npm run android` or `npm run ios`) and launch that development
build; Expo Go does not include the required speech-recognition module. The current
React Native ML Kit translation wrapper is alpha and untested with the New Architecture;
evaluate or replace it before production. Google ML Kit translation is intended for
casual use, not high-stakes translation.
