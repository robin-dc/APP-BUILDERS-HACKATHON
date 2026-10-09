import { Pressable, Text, View } from 'react-native';
import RouteOptionRow from './RouteOptionRow';

export default function RouteOptionsCard({ options, bestId, onStartRide, onCompare }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-surface">
      {options.map((option, i) => (
        <RouteOptionRow
          key={option.id}
          option={option}
          isBest={option.id === bestId}
          showDivider={i > 0}
        />
      ))}

      <View className="flex-row gap-2 px-3 pb-3 pt-1">
        <Pressable
          onPress={() => onStartRide?.(bestId)}
          className="flex-1 items-center rounded-xl bg-duck py-3 active:opacity-80"
        >
          <Text className="text-[15px] font-semibold text-ink">Start ride</Text>
        </Pressable>
        <Pressable
          onPress={onCompare}
          className="flex-1 items-center rounded-xl border border-line bg-surface py-3 active:bg-chip"
        >
          <Text className="text-[15px] font-semibold text-ink">Compare</Text>
        </Pressable>
      </View>
    </View>
  );
}
