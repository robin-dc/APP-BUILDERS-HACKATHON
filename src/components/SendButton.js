import { Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Round dark arrow button used by the chat bar and the translator bar.
export default function SendButton({ onPress, disabled, label = 'Send' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full bg-ink ${
        disabled ? 'opacity-40' : 'active:opacity-80'
      }`}
    >
      <MaterialCommunityIcons name="arrow-right" size={22} color={colors.white} />
    </Pressable>
  );
}
