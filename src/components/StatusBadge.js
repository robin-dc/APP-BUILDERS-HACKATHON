import { Text, View } from 'react-native';

export default function StatusBadge({ label = 'On-device AI' }) {
  return (
    <View className="flex-row items-center rounded-full bg-ok-bg px-3 py-1.5">
      <View className="mr-2 h-2 w-2 rounded-full bg-ok-dot" />
      <Text className="text-xs font-medium text-ok-text">{label}</Text>
    </View>
  );
}
