import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import ChatInputBar from '../components/chat/ChatInputBar';
import ChatMessage from '../components/chat/ChatMessage';
import TranslatorSheet from '../components/translator/TranslatorSheet';
import { handleMessage, newChat } from '../core/sakayChat';

let nextId = 0;
const withId = (message) => ({ id: `m${nextId++}`, ...message });

export default function ChatScreen() {
  // The chat state holds the stop conditions gathered so far, so each message builds on the last.
  const chatRef = useRef(null);
  if (!chatRef.current) chatRef.current = newChat();
  const [messages, setMessages] = useState(() => [withId(chatRef.current.message)]);
  const [draft, setDraft] = useState('');
  const [translatorOpen, setTranslatorOpen] = useState(false);
  const scrollRef = useRef(null);

  const send = (text) => {
    if (!text.trim()) return;
    const { state, message } = handleMessage(chatRef.current.state, text);
    chatRef.current = { state, message };
    setMessages((prev) => [...prev, withId({ role: 'user', text }), withId(message)]);
  };

  const stopStreaming = () =>
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-2"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            onSuggestion={send}
            onStartRide={() => {}}
            onCompare={() => {}}
            onStop={stopStreaming}
          />
        ))}
      </ScrollView>

      <ChatInputBar
        value={draft}
        onChangeText={setDraft}
        onSend={send}
        onTranslator={() => setTranslatorOpen(true)}
      />

      <TranslatorSheet
        visible={translatorOpen}
        onClose={() => setTranslatorOpen(false)}
        onInsert={setDraft}
      />
    </KeyboardAvoidingView>
  );
}
