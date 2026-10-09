import { Pressable, Text, View } from 'react-native';

export default function QuickPhrases({ phrases, onSelect }) {
  if (!phrases.length) return null;

  return (
    <View>
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Quick phrases</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {phrases.map((p) => (
          <Pressable
            key={p}
            onPress={() => onSelect(p)}
            className="max-w-full rounded-2xl border border-line bg-surface px-3.5 py-2 active:bg-chip"
          >
            <Text className="text-sm text-ink">{p}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
