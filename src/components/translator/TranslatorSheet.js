import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
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
import { DEMO_UTTERANCE, translate } from '../../core/translate';

const MAX_RECENT = 3;

export default function TranslatorSheet({ visible, onClose, onInsert }) {
  const [fromCode, setFromCode] = useState('tl');
  const [toCode, setToCode] = useState('en');
  const [recent, setRecent] = useState(DEFAULT_RECENT);
  const [picking, setPicking] = useState(null); // null | 'from' | 'to'
  const [listening, setListening] = useState(false);
  const [input, setInput] = useState(''); // what's in the text field
  const [sourceText, setSourceText] = useState(null); // what the result card shows
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const from = getLanguage(fromCode);
  const to = getLanguage(toCode);
  const translated = sourceText ? translate(sourceText, fromCode, toCode) : null;
  const quickPhrases = PHRASEBOOK.filter((p) => p.quick && p[fromCode]).map((p) => p[fromCode]);

  const close = () => {
    Speech.stop();
    setPicking(null);
    onClose();
  };

  // Every input path (typing, mic, quick phrase) ends here, so the field
  // always shows what was translated.
  const translateText = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput(trimmed);
    setSourceText(trimmed);
  };

  const swap = () => {
    if (translated) translateText(translated);
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const pickLanguage = (code) => {
    // Picking the language already on the other side swaps them.
    const other = picking === 'from' ? toCode : fromCode;
    if (code === other) swap();
    else if (picking === 'from') setFromCode(code);
    else setToCode(code);
    setRecent((r) => [code, ...r.filter((c) => c !== code)].slice(0, MAX_RECENT));
    setPicking(null);
  };

  // TODO: replace with real speech-to-text; for now releasing the mic "hears" a demo phrase.
  const startListening = () => {
    Speech.stop();
    setListening(true);
  };
  const stopListening = () => {
    setListening(false);
    translateText(DEMO_UTTERANCE);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(translated);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const insert = () => {
    onInsert?.(translated);
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} fullHeight>
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
          <ScrollView className="flex-1" contentContainerClassName="px-4 pb-2" keyboardShouldPersistTaps="handled">
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
                <MicButton listening={listening} onPressIn={startListening} onPressOut={stopListening} />
              </View>
            </View>

            {sourceText && (
              <View className="mt-5">
                <TranslationResultCard
                  from={from}
                  to={to}
                  sourceText={sourceText}
                  translatedText={translated}
                  copied={copied}
                  onPlay={() => Speech.speak(translated, { language: to.speechCode })}
                  onCopy={copy}
                  onInsert={insert}
                />
              </View>
            )}

            <View className="mb-2 mt-5">
              <QuickPhrases phrases={quickPhrases} onSelect={translateText} />
            </View>
          </ScrollView>

          {/* Pinned below the scroll area, like the chat input bar. */}
          <TranslateInput
            value={input}
            onChangeText={setInput}
            onSubmit={() => translateText(input)}
            languageName={from.name}
          />
        </View>
      )}
    </BottomSheet>
  );
}
