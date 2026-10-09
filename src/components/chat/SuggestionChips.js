import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

// Tappable prompts under a reply. They use the soft duck yellow and a small arrow so they read as
// buttons next to the white reply bubble, without competing with it.
export default function SuggestionChips({ suggestions, onSelect }) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {suggestions.map((label) => (
        // max-w-full + shrink let a long label wrap inside the chip instead of running off narrow
        // screens; rounded-2xl keeps two-line chips from clipping text at fully rounded ends.
        <Pressable
          key={label}
          onPress={() => onSelect?.(label)}
          accessibilityRole="button"
          className="max-w-full flex-row items-center rounded-2xl border border-duck-pill bg-duck-soft px-3.5 py-2 active:bg-duck-pill"
        >
          <Text className="shrink text-sm font-medium text-ink">{label}</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={colors.inkMuted} style={{ marginLeft: 6 }} />
        </Pressable>
      ))}
    </View>
  );
}
