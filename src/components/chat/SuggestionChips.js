import { Pressable, Text, View } from 'react-native';

export default function SuggestionChips({ suggestions, onSelect }) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {suggestions.map((label) => (
        <Pressable
          key={label}
          onPress={() => onSelect?.(label)}
          className="rounded-full border border-line bg-surface px-4 py-2 active:bg-chip"
        >
          <Text className="text-sm text-ink">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
