import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

function ActionButton({ label, icon, primary, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center rounded-full px-4 py-2.5 ${
        primary ? 'bg-ink' : 'border border-line bg-surface'
      } ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={primary ? colors.white : colors.ink}
          style={{ marginRight: 6 }}
        />
      )}
      <Text className={`text-sm font-semibold ${primary ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * translatedText === null means no offline translation is available yet.
 */
export default function TranslationResultCard({
  from,
  to,
  sourceText,
  translatedText,
  copied,
  onPlay,
  onCopy,
  onInsert,
}) {
  const missing = translatedText == null;

  return (
    <View className="rounded-2xl bg-chip p-4">
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{from.name}</Text>
      <Text className="mt-1 text-[15px] leading-6 text-ink">{sourceText}</Text>

      <View className="my-3 h-px bg-line" />

      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{to.name}</Text>
      {missing ? (
        <Text className="mt-1 text-[15px] italic text-ink-muted">
          Not in the offline phrasebook yet.
        </Text>
      ) : (
        <Text className="mt-1 text-xl font-bold leading-7 text-ink">{translatedText}</Text>
      )}

      <View className="mt-3 flex-row flex-wrap gap-2">
        <ActionButton label="Play" icon="volume-high" primary onPress={onPlay} disabled={missing} />
        <ActionButton label={copied ? 'Copied' : 'Copy'} onPress={onCopy} disabled={missing} />
        <ActionButton label="Insert in chat" onPress={onInsert} disabled={missing} />
      </View>
    </View>
  );
}
