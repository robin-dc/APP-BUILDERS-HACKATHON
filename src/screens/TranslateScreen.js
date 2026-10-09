import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEventListener } from 'expo';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Speech from 'expo-speech';
import TranslateText, {
  TranslateLanguage,
} from '@react-native-ml-kit/translate-text';

const SpeechRecognitionModule = requireOptionalNativeModule('ExpoSpeechRecognition');

const LANGUAGES = {
  english: {
    label: 'English',
    locale: 'en-US',
    translation: TranslateLanguage.ENGLISH,
  },
  tagalog: {
    label: 'Tagalog',
    locale: 'tl-PH',
    translation: TranslateLanguage.TAGALOG,
  },
};

function SpeechRecognitionEvents({ onStart, onEnd, onResult, onError }) {
  useEventListener(SpeechRecognitionModule, 'start', onStart);
  useEventListener(SpeechRecognitionModule, 'end', onEnd);
  useEventListener(SpeechRecognitionModule, 'result', onResult);
  useEventListener(SpeechRecognitionModule, 'error', onError);
  return null;
}

export default function TranslateScreen() {
  const [sourceKey, setSourceKey] = useState('english');
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');

  const source = LANGUAGES[sourceKey];
  const target = LANGUAGES[sourceKey === 'english' ? 'tagalog' : 'english'];
  const isBusy = isStarting || isListening || isTranslating;

  useEffect(
    () => () => {
      Speech.stop().catch((speechError) => {
        console.error('Failed to stop speech playback when closing translator.', speechError);
      });
    },
    [],
  );

  const handleRecognitionStart = () => {
    setIsListening(true);
    setIsStarting(false);
    setError('');
  };

  const handleRecognitionEnd = () => setIsListening(false);

  const handleRecognitionResult = (event) => {
    const result = event.results[0]?.transcript;
    if (result) {
      setTranscript(result);
      setTranslation('');
      setError('');
    }
  };

  const handleRecognitionError = (event) => {
    setIsListening(false);
    setIsStarting(false);
    setError(event.message || `Speech recognition failed (${event.error}).`);
  };

  const stopPlayback = () => {
    if (!isSpeaking) return;

    Speech.stop()
      .then(() => setIsSpeaking(false))
      .catch((speechError) =>
        setError(speechError.message || 'Could not stop speech playback.'),
      );
  };

  const startListening = async () => {
    if (isBusy) return;

    if (!SpeechRecognitionModule) {
      setError(
        'Voice input needs the Biyahe Buddy development build. Expo Go does not include speech recognition.',
      );
      return;
    }

    setIsStarting(true);
    setError('');
    setTranslation('');

    try {
      const permission = await SpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Allow microphone and speech recognition access to use voice input.');
        setIsStarting(false);
        return;
      }

      setTranscript('');
      SpeechRecognitionModule.start({
        lang: source.locale,
        interimResults: true,
        continuous: false,
      });
    } catch (recognitionError) {
      setError(
        recognitionError instanceof Error
          ? recognitionError.message
          : 'Could not start speech recognition on this device.',
      );
      setIsStarting(false);
    }
  };

  const translate = async () => {
    const text = transcript.trim();
    if (!text) {
      setError('Enter or say something before translating.');
      return;
    }

    setIsTranslating(true);
    setError('');
    try {
      const result = await TranslateText.translate({
        text,
        sourceLanguage: source.translation,
        targetLanguage: target.translation,
        downloadModelIfNeeded: true,
      });
      setTranslation(result);
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Translation failed. Check your connection and try again.',
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const swapLanguages = () => {
    stopPlayback();
    setSourceKey((current) => (current === 'english' ? 'tagalog' : 'english'));
    setTranscript('');
    setTranslation('');
    setError('');
  };

  const updateTranscript = (text) => {
    stopPlayback();
    setTranscript(text);
    setTranslation('');
    setError('');
  };

  const speakTranslation = () => {
    if (!translation) return;

    if (isSpeaking) {
      stopPlayback();
      return;
    }

    setError('');
    setIsSpeaking(true);
    try {
      Speech.speak(translation, {
        language: target.locale,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: (speechError) => {
          setIsSpeaking(false);
          setError(
            speechError.message || `Speech playback is unavailable for ${target.label}.`,
          );
        },
      });
    } catch (speechError) {
      setIsSpeaking(false);
      setError(
        speechError instanceof Error
          ? speechError.message
          : 'Could not start speech playback.',
      );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="px-5 pb-8 pt-5"
      keyboardShouldPersistTaps="handled"
    >
      {SpeechRecognitionModule ? (
        <SpeechRecognitionEvents
          onStart={handleRecognitionStart}
          onEnd={handleRecognitionEnd}
          onResult={handleRecognitionResult}
          onError={handleRecognitionError}
        />
      ) : null}

      <View className="mb-6">
        <Text className="text-3xl font-bold tracking-tight text-slate-900">
          Speak freely.
        </Text>
        <Text className="mt-1 text-base text-slate-500">
          Your travel phrases, translated.
        </Text>
      </View>

      <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Source language: ${source.label}. Change direction`}
          disabled={isBusy}
          onPress={swapLanguages}
          className={`flex-1 rounded-xl px-4 py-3 ${
            isBusy ? 'bg-slate-100' : 'bg-blue-50'
          }`}
        >
          <Text className="text-xs font-medium uppercase tracking-wider text-blue-600">
            From
          </Text>
          <Text className="mt-1 text-base font-semibold text-slate-900">
            {source.label}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Swap languages"
          disabled={isBusy}
          onPress={swapLanguages}
          className={`mx-2 h-11 w-11 items-center justify-center rounded-full ${
            isBusy ? 'bg-slate-50' : 'bg-slate-100'
          }`}
        >
          <Text className="text-xl font-semibold text-slate-600">⇄</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Target language: ${target.label}. Change direction`}
          disabled={isBusy}
          onPress={swapLanguages}
          className={`flex-1 rounded-xl px-4 py-3 ${
            isBusy ? 'bg-slate-100' : 'bg-emerald-50'
          }`}
        >
          <Text className="text-xs font-medium uppercase tracking-wider text-emerald-700">
            To
          </Text>
          <Text className="mt-1 text-base font-semibold text-slate-900">
            {target.label}
          </Text>
        </Pressable>
      </View>

      <View className="mb-4 rounded-3xl border border-slate-200 bg-white p-5">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-slate-500">
            {source.label}
          </Text>
          {isStarting ? (
            <Text className="text-xs text-slate-400">Getting ready...</Text>
          ) : isListening ? (
            <View className="flex-row items-center">
              <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
              <Text className="text-xs font-semibold text-red-600">Listening</Text>
            </View>
          ) : transcript ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear source text"
              onPress={() => updateTranscript('')}
              className="px-2 py-1"
            >
              <Text className="text-xs font-semibold text-blue-600">Clear</Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-slate-400">You can type or speak</Text>
          )}
        </View>

        <TextInput
          accessibilityLabel={`Text in ${source.label}`}
          multiline
          editable={!isBusy}
          value={transcript}
          onChangeText={updateTranscript}
          placeholder="Type a phrase or tap the microphone..."
          placeholderTextColor="#94a3b8"
          textAlignVertical="top"
          className="min-h-28 text-lg leading-7 text-slate-900"
        />

        <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-4">
          <Text className="flex-1 pr-3 text-xs leading-5 text-slate-400">
            {isStarting
              ? 'Requesting microphone access...'
              : 'Speech recognition availability depends on your device and language settings.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isListening
                ? 'Stop listening'
                : isStarting
                  ? 'Starting speech recognition'
                  : 'Start speaking'
            }
            disabled={isStarting || isTranslating}
            onPress={() => {
              if (isListening) {
                SpeechRecognitionModule.stop();
              } else {
                startListening();
              }
            }}
            className={`h-14 w-14 items-center justify-center rounded-full ${
              isListening ? 'bg-red-500' : isStarting ? 'bg-blue-400' : 'bg-blue-600'
            }`}
          >
            {isStarting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-2xl text-white">{isListening ? '■' : '🎙'}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!transcript.trim() || isBusy}
        onPress={translate}
        className={`mb-5 min-h-14 flex-row items-center justify-center rounded-2xl ${
          transcript.trim() && !isBusy
            ? 'bg-blue-600'
            : 'bg-blue-300'
        }`}
      >
        {isTranslating ? (
          <>
            <ActivityIndicator color="#ffffff" />
            <Text className="ml-2 text-base font-semibold text-white">
              Preparing translation...
            </Text>
          </>
        ) : (
          <Text className="text-base font-semibold text-white">Translate phrase</Text>
        )}
      </Pressable>

      <View className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-emerald-800">
            {target.label}
          </Text>
          {translation ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isSpeaking
                  ? `Stop ${target.label} playback`
                  : `Play ${target.label} translation`
              }
              onPress={speakTranslation}
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
            >
              <Text className="text-lg text-emerald-700">{isSpeaking ? '■' : '▶'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className={`text-lg leading-7 ${translation ? 'text-slate-900' : 'text-slate-400'}`}>
          {translation || 'Your translation will appear here.'}
        </Text>
      </View>

      {error ? (
        <View accessibilityRole="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-sm leading-5 text-red-700">{error}</Text>
        </View>
      ) : null}

      <Text className="mt-5 text-center text-xs leading-5 text-slate-400">
        Automatic translation powered by{' '}
        <Text
          accessibilityRole="link"
          className="font-semibold text-slate-500 underline"
          onPress={() =>
            Linking.openURL('https://translate.google.com/').catch(() =>
              setError('Could not open the Google Translate website.'),
            )
          }
        >
          Google Translate
        </Text>{' '}
        (ML Kit, on-device). Speech recognition may use your device provider.
      </Text>
    </ScrollView>
  );
}
