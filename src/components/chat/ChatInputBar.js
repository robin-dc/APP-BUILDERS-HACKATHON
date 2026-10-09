import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SendButton from '../SendButton';
import { colors } from '../../theme/colors';

function TranslatorButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-xl bg-duck-soft px-3 py-1.5 active:opacity-70"
    >
      <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.ink} />
      <Text className="mt-0.5 text-[11px] font-semibold text-ink">Translator</Text>
    </Pressable>
  );
}

// Controlled input: the parent owns `value` so other UI (e.g. the translator) can fill it.
export default function ChatInputBar({
  value,
  onChangeText,
  onSend,
  onTranslator,
  placeholder = 'Ask Ducky anything...',
}) {
  const trimmed = value.trim();

  const send = () => {
    if (!trimmed) return;
    onSend?.(trimmed);
    onChangeText('');
  };

  return (
    <View className="flex-row items-center gap-2 border-t border-line bg-surface px-3 py-2.5">
      <TranslatorButton onPress={onTranslator} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={send}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        returnKeyType="send"
        className="h-11 flex-1 rounded-full border border-line bg-chip px-4 text-[15px] text-ink"
      />
      <SendButton onPress={send} disabled={!trimmed} />
    </View>
  );
}
