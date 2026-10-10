import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useEventListener } from 'expo';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import TranslateText, {
  TranslateLanguage,
} from '@react-native-ml-kit/translate-text';
import BottomSheet from '../BottomSheet';
import IconButton from '../IconButton';
import LanguagePicker from './LanguagePicker';
import LanguageSelector from './LanguageSelector';
import MicButton from './MicButton';
import QuickPhrases from './QuickPhrases';
import TranslateInput from './TranslateInput';
import TranslationResultCard from './TranslationResultCard';
import Waveform from './Waveform';
import { DEFAULT_RECENT, getLanguage } from '../../data/languages';
import { PHRASEBOOK } from '../../data/phrasebook';

const SpeechRecognitionModule = requireOptionalNativeModule('ExpoSpeechRecognition');

const ML_KIT_LANGUAGES = {
  en: TranslateLanguage.ENGLISH,
  tl: TranslateLanguage.TAGALOG,
  ko: TranslateLanguage.KOREAN,
  ja: TranslateLanguage.JAPANESE,
  zh: TranslateLanguage.CHINESE,
  es: TranslateLanguage.SPANISH,
};

function SpeechRecognitionEvents({ onStart, onEnd, onResult, onError }) {
  useEventListener(SpeechRecognitionModule, 'start', onStart);
  useEventListener(SpeechRecognitionModule, 'end', onEnd);
  useEventListener(SpeechRecognitionModule, 'result', onResult);
  useEventListener(SpeechRecognitionModule, 'error', onError);
  return null;
}

const MAX_RECENT = 3;

export default function TranslatorSheet({ visible, onClose, onInsert }) {
  const [fromCode, setFromCode] = useState('tl');
  const [toCode, setToCode] = useState('en');
  const [recent, setRecent] = useState(DEFAULT_RECENT);
  const [picking, setPicking] = useState(null);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [input, setInput] = useState('');
  const [sourceText, setSourceText] = useState(null);
  const [translated, setTranslated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copiedTimer = useRef(null);
  const requestId = useRef(0);
  const startAttempt = useRef(0);
  const microphoneHeld = useRef(false);
  const recognitionRequested = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(
    () => () => {
      clearTimeout(copiedTimer.current);
      Speech.stop().catch((speechError) => {
        console.error('Failed to stop speech playback when closing translator.', speechError);
      });
    },
    [],
  );

  const from = getLanguage(fromCode);
  const to = getLanguage(toCode);
  const quickPhrases = PHRASEBOOK.filter((phrase) => phrase.quick && phrase[fromCode]).map(
    (phrase) => phrase[fromCode],
  );

  const clearResult = () => {
    requestId.current += 1;
    setSourceText(null);
    setTranslated(null);
    setTranslating(false);
    setError('');
  };

  const close = () => {
    startAttempt.current += 1;
    requestId.current += 1;
    microphoneHeld.current = false;
    if (recognitionRequested.current) {
      recognitionRequested.current = false;
      SpeechRecognitionModule?.stop();
    }
    Speech.stop().catch((speechError) => {
      setError(speechError.message || 'Could not stop speech playback.');
    });
    setStarting(false);
    setListening(false);
    setPicking(null);
    onClose();
  };

  const translateText = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const currentRequest = ++requestId.current;
    setInput(trimmed);
    setSourceText(trimmed);
    setTranslated(null);
    setError('');
    setCopied(false);

    const sourceLanguage = ML_KIT_LANGUAGES[fromCode];
    const targetLanguage = ML_KIT_LANGUAGES[toCode];
    if (!sourceLanguage || !targetLanguage) {
      setError(
        'On-device translation currently supports English, Tagalog, Korean, Japanese, Chinese, and Spanish.',
      );
      return;
    }

    setTranslating(true);
    try {
      const result = await TranslateText.translate({
        text: trimmed,
        sourceLanguage,
        targetLanguage,
        downloadModelIfNeeded: true,
      });
      if (currentRequest === requestId.current) setTranslated(result);
    } catch (translationError) {
      if (currentRequest !== requestId.current) return;
      const message =
        translationError instanceof Error ? translationError.message : String(translationError);
      setError(
        message.includes("doesn't seem to be linked")
          ? 'The translation module is not in this app build. Rebuild and reinstall the development app.'
          : message || 'Translation failed. Check your connection and try again.',
      );
    } finally {
      if (currentRequest === requestId.current) setTranslating(false);
    }
  };

  const swap = () => {
    startAttempt.current += 1;
    microphoneHeld.current = false;
    if (recognitionRequested.current) {
      recognitionRequested.current = false;
      SpeechRecognitionModule?.stop();
    }
    setStarting(false);
    setListening(false);
    setFromCode(toCode);
    setToCode(fromCode);
    setInput('');
    clearResult();
  };

  const pickLanguage = (code) => {
    const other = picking === 'from' ? toCode : fromCode;
    if (code === other) {
      swap();
    } else {
      if (picking === 'from') setFromCode(code);
      else setToCode(code);
      setInput('');
      clearResult();
    }
    setRecent((current) => [code, ...current.filter((item) => item !== code)].slice(0, MAX_RECENT));
    setPicking(null);
  };

  const startListening = async () => {
    if (starting || listening || translating) return;
    if (!SpeechRecognitionModule) {
      setError(
        'Voice input needs the Biyahe Buddy development build. Expo Go does not include speech recognition.',
      );
      return;
    }

    const attempt = ++startAttempt.current;
    setStarting(true);
    setError('');
    try {
      const permission = await SpeechRecognitionModule.requestPermissionsAsync();
      if (
        attempt !== startAttempt.current ||
        !visibleRef.current ||
        !microphoneHeld.current
      ) {
        if (attempt === startAttempt.current) setStarting(false);
        return;
      }
      if (!permission.granted) {
        setError('Allow microphone access in Android Settings to use voice input.');
        setStarting(false);
        return;
      }

      clearResult();
      setInput('');
      recognitionRequested.current = true;
      SpeechRecognitionModule.start({
        lang: from.recognitionCode || from.speechCode,
        interimResults: true,
        continuous: false,
      });
    } catch (recognitionError) {
      recognitionRequested.current = false;
      if (attempt !== startAttempt.current) return;
      setError(
        recognitionError instanceof Error
          ? recognitionError.message
          : 'Could not start speech recognition on this device.',
      );
      setStarting(false);
    }
  };

  const handleMicPressIn = () => {
    microphoneHeld.current = true;
    startListening();
  };

  const handleMicPressOut = () => {
    microphoneHeld.current = false;
    startAttempt.current += 1;
    setStarting(false);
    setListening(false);
    if (recognitionRequested.current) {
      recognitionRequested.current = false;
      SpeechRecognitionModule?.stop();
    }
  };

  const handleRecognitionStart = () => {
    if (!microphoneHeld.current) {
      SpeechRecognitionModule?.stop();
      return;
    }
    setStarting(false);
    setListening(true);
    setError('');
  };

  const handleRecognitionEnd = () => {
    recognitionRequested.current = false;
    microphoneHeld.current = false;
    setStarting(false);
    setListening(false);
  };

  const handleRecognitionResult = (event) => {
    const transcript = event.results[0]?.transcript;
    if (!transcript) return;
    setInput(transcript);
    if (event.isFinal) translateText(transcript);
  };

  const handleRecognitionError = (event) => {
    recognitionRequested.current = false;
    setStarting(false);
    microphoneHeld.current = false;
    setListening(false);
    setError(event.message || `Speech recognition failed (${event.error}).`);
  };

  const copy = async () => {
    if (!translated) return;
    try {
      await Clipboard.setStringAsync(translated);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch (clipboardError) {
      setError(clipboardError.message || 'Could not copy the translation.');
    }
  };

  const insert = () => {
    if (!translated) return;
    onInsert?.(translated);
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} fullHeight>
      {visible && SpeechRecognitionModule ? (
        <SpeechRecognitionEvents
          onStart={handleRecognitionStart}
          onEnd={handleRecognitionEnd}
          onResult={handleRecognitionResult}
          onError={handleRecognitionError}
        />
      ) : null}
      {picking ? (
        <LanguagePicker
          subtitle={picking === 'from' ? 'Translate from' : 'Translate to'}
          selectedCode={picking === 'from' ? fromCode : toCode}
          recentCodes={recent}
          onSelect={pickLanguage}
          onBack={() => setPicking(null)}
        />
      ) : (
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 pb-2"
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-2xl font-bold text-ink">Translator</Text>
              <IconButton icon="close" onPress={close} label="Close translator" />
            </View>

            <View className="mt-3">
              <LanguageSelector
                from={from}
                to={to}
                onPressFrom={() => setPicking('from')}
                onPressTo={() => setPicking('to')}
                onSwap={swap}
              />
            </View>

            <View className="mt-6 items-center">
              <Waveform active={listening} />
              <View className="mt-3">
                <MicButton
                  listening={listening}
                  starting={starting}
                  disabled={translating && !listening && !starting}
                  onPressIn={handleMicPressIn}
                  onPressOut={handleMicPressOut}
                />
              </View>
            </View>

            {error ? (
              <Text accessibilityRole="alert" className="mt-4 text-center text-sm text-red-700">
                {error}
              </Text>
            ) : null}

            {sourceText && (
              <View className="mt-5">
                <TranslationResultCard
                  from={from}
                  to={to}
                  sourceText={sourceText}
                  translatedText={translated}
                  loading={translating}
                  copied={copied}
                  onPlay={() => {
                    if (translated) Speech.speak(translated, { language: to.speechCode });
                  }}
                  onCopy={copy}
                  onInsert={insert}
                />
              </View>
            )}

            <View className="mb-2 mt-5">
              <QuickPhrases phrases={quickPhrases} onSelect={translateText} />
            </View>
          </ScrollView>

          <TranslateInput
            value={input}
            onChangeText={(text) => {
              setInput(text);
              clearResult();
            }}
            onSubmit={() => translateText(input)}
            languageName={from.name}
            disabled={listening || starting || translating}
          />
        </View>
      )}
    </BottomSheet>
  );
}
