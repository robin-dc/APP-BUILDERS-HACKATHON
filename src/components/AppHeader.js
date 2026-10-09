import { Pressable, Text, View } from 'react-native';
import DuckAvatar from './DuckAvatar';
import StatusBadge from './StatusBadge';

export default function AppHeader({ title = 'Travel Ducky', status = 'Local-first demo', onLogoPress }) {
  return (
    <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
      <Pressable
        onPress={onLogoPress}
        disabled={!onLogoPress}
        accessibilityRole="button"
        accessibilityLabel="Restart app"
        className="flex-row items-center active:opacity-60"
      >
        <DuckAvatar size={34} />
        <Text className="ml-3 text-xl font-bold text-ink">{title}</Text>
      </Pressable>
      <StatusBadge label={status} />
    </View>
  );
}
