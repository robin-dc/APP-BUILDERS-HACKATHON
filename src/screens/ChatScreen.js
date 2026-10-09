import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import ChatInputBar from '../components/chat/ChatInputBar';
import ChatMessage from '../components/chat/ChatMessage';
import TranslatorSheet from '../components/translator/TranslatorSheet';
import { demoConversation } from '../data/demoConversation';

export default function ChatScreen() {
  const [messages, setMessages] = useState(demoConversation);
  const [draft, setDraft] = useState('');
  const [translatorOpen, setTranslatorOpen] = useState(false);
  const scrollRef = useRef(null);

  const send = (text) => {
    // TODO: hand off to intent extraction + planTrip(); for now just echo the user message.
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text }]);
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
