import { Pressable, Text, View } from 'react-native';

export default function SuggestionChips({ suggestions, onSelect }) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {suggestions.map((label) => (
        // max-w-full lets a long label wrap inside the chip instead of running off narrow
        // screens; rounded-2xl keeps two-line chips from clipping text at fully rounded ends.
        <Pressable
          key={label}
          onPress={() => onSelect?.(label)}
          className="max-w-full rounded-2xl border border-line bg-surface px-4 py-2 active:bg-chip"
        >
          <Text className="text-sm text-ink">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
