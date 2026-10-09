import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Right side shows, in priority order: check (selected), size (needs download), Offline badge.
export default function LanguageRow({ language, selected, showOfflineBadge, onPress }) {
  const { name, native, offline, sizeLabel } = language;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-xl px-2.5 py-3 ${
        selected ? 'bg-duck-soft' : 'active:bg-chip'
      }`}
    >
      <Text className="flex-1 text-[15px] text-ink-muted" numberOfLines={1}>
        <Text className="font-bold text-ink">{name}</Text> · {native}
      </Text>

      {selected ? (
        <MaterialCommunityIcons name="check" size={20} color={colors.ok} />
      ) : !offline ? (
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="download" size={16} color={colors.inkMuted} />
          <Text className="ml-1 text-xs font-semibold text-ink-muted">{sizeLabel}</Text>
        </View>
      ) : showOfflineBadge ? (
        <View className="rounded-full bg-ok-bg px-2.5 py-1">
          <Text className="text-[11px] font-semibold text-ok-text">Offline</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
