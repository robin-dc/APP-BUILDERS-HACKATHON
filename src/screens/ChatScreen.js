import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import ChatInputBar from '../components/chat/ChatInputBar';
import ChatMessage from '../components/chat/ChatMessage';
import TranslatorSheet from '../components/translator/TranslatorSheet';
import { askGuide, isTravelQuestion, mentionsDestination, stopGuide } from '../ai/travelGuide';
import { readSentence } from '../core/model';
import { handleMessage, newChat, NEW_TRIP } from '../core/sakayChat';

// Two assistants share the chat: the travel guide (places, food, how to get there) and
// "sakay o hintay" (ride this jeep or wait). A named place always goes to the guide; stop
// conditions like rain, a full jeep or minutes left go to sakay o hintay.
function routeTo(text) {
  if (mentionsDestination(text)) return 'guide';
  if (text === NEW_TRIP || readSentence(text, new Date().getHours()).understood.length) return 'sakay';
  return isTravelQuestion(text) ? 'guide' : 'sakay';
}

export default function ChatScreen() {
  // Message ids must stay unique for the life of the chat: streaming replies are updated by id, so a
  // repeated id overwrites an older bubble. The counter lives in a ref (kept across hot reloads, unlike
  // a module variable) and ids are made outside state updaters, which React may run twice.
  const idRef = useRef(0);
  const withId = (message) => ({ id: `m${idRef.current++}`, ...message });

  // The chat state holds the stop conditions gathered so far, so each message builds on the last.
  const chatRef = useRef(null);
  if (!chatRef.current) chatRef.current = newChat();
  const [messages, setMessages] = useState(() => [withId(chatRef.current.message)]);
  const [draft, setDraft] = useState('');
  const [translatorOpen, setTranslatorOpen] = useState(false);
  const scrollRef = useRef(null);
  const busyRef = useRef(false);

  const patch = (id, changes) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  // Adds the user's message and the reply. Chips on earlier messages are dropped once the user
  // has answered, so used template prompts don't linger; the new reply may bring its own.
  const addTurn = (text, reply) => {
    const userMessage = withId({ role: 'user', text });
    setMessages((prev) => [...prev.map(({ suggestions, ...m }) => m), userMessage, reply]);
  };

  const askTravelGuide = async (text) => {
    const reply = withId({ role: 'assistant', text: '…', streaming: true });
    addTurn(text, reply);
    busyRef.current = true;
    try {
      const { text: answer } = await askGuide(text, (soFar) => patch(reply.id, { text: soFar }));
      patch(reply.id, { text: answer, streaming: false });
    } catch (e) {
      console.warn('[guide]', e?.message ?? e);
      patch(reply.id, {
        text:
          Platform.OS === 'web'
            ? `The travel guide couldn't reach its models. ${e?.message ?? ''}`
            : "Sorry, the on-device travel guide isn't available right now. It needs the app's development build, not Expo Go.",
        streaming: false,
      });
    } finally {
      busyRef.current = false;
    }
  };

  const send = (text) => {
    if (!text.trim()) return;
    if (busyRef.current) {
      const note = withId({ role: 'assistant', text: 'Still answering your last question, one moment.' });
      setMessages((prev) => [...prev, note]);
      return;
    }
    if (routeTo(text) === 'guide') {
      askTravelGuide(text);
      return;
    }
    const { state, message } = handleMessage(chatRef.current.state, text);
    chatRef.current = { state, message };
    addTurn(text, withId(message));
  };

  const stopStreaming = () => {
    stopGuide();
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
