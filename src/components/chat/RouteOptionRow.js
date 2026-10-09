import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Maps a route mode to its icon. Add modes (jeep, grab, walk...) here.
const MODE_ICONS = {
  rail: 'train',
  bus: 'bus',
  jeep: 'van-passenger',
  ride: 'car',
  walk: 'walk',
};

export default function RouteOptionRow({ option, isBest, showDivider }) {
  const { mode, title, fare, duration } = option;

  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${isBest ? 'bg-duck-soft' : ''} ${
        showDivider ? 'border-t border-line' : ''
      }`}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-lg ${isBest ? 'bg-ink' : 'bg-chip'}`}
      >
        <MaterialCommunityIcons
          name={MODE_ICONS[mode] ?? 'map-marker-path'}
          size={20}
          color={isBest ? colors.white : colors.ink}
        />
      </View>

      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-bold text-ink">{title}</Text>
        <Text className="mt-0.5 text-[13px] text-ink-muted">
          {fare} · {duration} (estimate)
        </Text>
      </View>

      {isBest && (
        <View className="rounded-full bg-duck-pill px-2.5 py-1">
          <Text className="text-[11px] font-bold text-ink">BEST</Text>
        </View>
      )}
    </View>
  );
}
