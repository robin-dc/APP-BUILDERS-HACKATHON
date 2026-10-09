import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import IconButton from '../IconButton';
import { colors } from '../../theme/colors';

function LanguageField({ label, language, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-xl border border-line bg-chip px-3 py-2.5 active:opacity-70"
    >
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</Text>
      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="flex-1 text-[15px] font-bold text-ink" numberOfLines={1}>
          {language.name}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.ink} />
      </View>
    </Pressable>
  );
}

export default function LanguageSelector({ from, to, onPressFrom, onPressTo, onSwap }) {
  return (
    <View className="flex-row items-center gap-2">
      <LanguageField label="From" language={from} onPress={onPressFrom} />
      <IconButton icon="swap-horizontal" variant="outline" onPress={onSwap} label="Swap languages" />
      <LanguageField label="To" language={to} onPress={onPressTo} />
    </View>
  );
}
