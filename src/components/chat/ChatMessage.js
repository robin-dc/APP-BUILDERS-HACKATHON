import { View } from 'react-native';
import RichText from '../RichText';
import AssistantBubble from './AssistantBubble';
import AssistantMessage from './AssistantMessage';
import RouteOptionsCard from './RouteOptionsCard';
import StopButton from './StopButton';
import SuggestionChips from './SuggestionChips';
import TypingCursor from './TypingCursor';
import UserBubble from './UserBubble';

/**
 * Renders one message from the conversation data.
 *
 * user:      { role: 'user', text }
 * assistant: { role: 'assistant', text?, suggestions?, routes?: { options, bestId },
 *              explanation?, streaming? }
 * Assistant parts render top to bottom in the order listed.
 */
export default function ChatMessage({ message, onSuggestion, onStartRide, onCompare, onStop }) {
  if (message.role === 'user') return <UserBubble text={message.text} />;

  const { text, suggestions, routes, explanation, streaming } = message;
  // The cursor sits on whichever text is last in the reply.
  const cursor = streaming ? <TypingCursor /> : null;

  return (
    <AssistantMessage>
      {text && (
        <AssistantBubble>
          <RichText text={text}>{!explanation && cursor}</RichText>
        </AssistantBubble>
      )}
      {suggestions && <SuggestionChips suggestions={suggestions} onSelect={onSuggestion} />}
      {routes && (
        <View className={text ? 'mt-3' : ''}>
          <RouteOptionsCard
            options={routes.options}
            bestId={routes.bestId}
            onStartRide={onStartRide}
            onCompare={onCompare}
          />
        </View>
      )}
      {explanation && (
        <AssistantBubble className="mt-3">
          <RichText text={explanation}>{cursor}</RichText>
        </AssistantBubble>
      )}
      {streaming && <StopButton onPress={onStop} />}
    </AssistantMessage>
  );
}
