// Languages shown in the translator picker.
// offline: true  -> model is on the phone ("Offline" badge)
// offline: false -> needs a download first; sizeLabel shows on the right
// speechCode is the BCP 47 tag passed to text-to-speech.
// recognitionCode overrides it when speech recognition uses a different locale.

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', offline: true, speechCode: 'en-US' },
  {
    code: 'tl',
    name: 'Tagalog',
    native: 'Filipino',
    offline: true,
    speechCode: 'fil-PH',
    recognitionCode: 'tl-PH',
  },
  { code: 'ceb', name: 'Cebuano', native: 'Bisaya', offline: true, speechCode: 'fil-PH' },
  { code: 'ilo', name: 'Ilocano', native: 'Ilokano', offline: true, speechCode: 'fil-PH' },
  { code: 'hil', name: 'Hiligaynon', native: 'Ilonggo', offline: true, speechCode: 'fil-PH' },
  { code: 'ko', name: 'Korean', native: '한국어', offline: false, sizeLabel: '[SIZE]', speechCode: 'ko-KR' },
  { code: 'ja', name: 'Japanese', native: '日本語', offline: false, sizeLabel: '[SIZE]', speechCode: 'ja-JP' },
  { code: 'zh', name: 'Chinese (Mandarin)', native: '中文', offline: false, sizeLabel: '[SIZE]', speechCode: 'zh-CN' },
  { code: 'es', name: 'Spanish', native: 'Español', offline: false, sizeLabel: '[SIZE]', speechCode: 'es-ES' },
];

export const DEFAULT_RECENT = ['en', 'tl'];

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code);
}
