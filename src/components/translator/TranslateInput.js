import { TextInput, View } from 'react-native';
import SendButton from '../SendButton';
import { colors } from '../../theme/colors';

// Bottom input bar for the translator, styled like the chat bar.
// Controlled: the sheet owns `value`.
export default function TranslateInput({
  value,
  onChangeText,
  onSubmit,
  languageName,
  disabled = false,
}) {
  const empty = !value.trim() || disabled;

  return (
    <View className="flex-row items-center gap-2 border-t border-line bg-surface px-3 pt-2.5">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        editable={!disabled}
        placeholder={`Type in ${languageName}…`}
        placeholderTextColor={colors.placeholder}
        returnKeyType="go"
        className="h-11 flex-1 rounded-full border border-line bg-chip px-4 text-[15px] text-ink"
      />
      <SendButton onPress={onSubmit} disabled={empty} label="Translate" />
    </View>
  );
}
