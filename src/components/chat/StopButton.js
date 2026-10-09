import { Pressable, Text, View } from 'react-native';

// Shown while a reply is streaming; cancels generation.
export default function StopButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-3 flex-row items-center self-start rounded-full border border-line bg-chip px-3 py-1.5 active:opacity-70"
    >
      <View className="mr-1.5 h-2 w-2 rounded-[1px] bg-ink-muted" />
      <Text className="text-xs font-medium text-ink">Stop</Text>
    </Pressable>
  );
}
