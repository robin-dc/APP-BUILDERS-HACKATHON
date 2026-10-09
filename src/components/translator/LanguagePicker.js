import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import IconButton from '../IconButton';
import LanguageRow from './LanguageRow';
import { LANGUAGES } from '../../data/languages';
import { colors } from '../../theme/colors';

function SectionLabel({ children }) {
  return (
    <Text className="mb-1 mt-4 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
      {children}
    </Text>
  );
}

/**
 * Full language list grouped into Recent / On this phone / Download.
 * A language appears in only one section; Recent wins.
 */
export default function LanguagePicker({ subtitle, selectedCode, recentCodes, onSelect, onBack }) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = LANGUAGES.filter(
      (l) => !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q)
    );
    const recent = recentCodes.map((c) => matches.find((l) => l.code === c)).filter(Boolean);
    const rest = matches.filter((l) => !recentCodes.includes(l.code));
    return [
      { key: 'recent', title: 'Recent', items: recent },
      { key: 'offline', title: 'On this phone · Works offline', items: rest.filter((l) => l.offline), badge: true },
      { key: 'download', title: 'Download to use offline', items: rest.filter((l) => !l.offline) },
    ].filter((s) => s.items.length);
  }, [query, recentCodes]);

  return (
    <View className="flex-1 px-4">
      <View className="flex-row items-center pb-3 pt-1">
        <IconButton icon="chevron-left" iconSize={24} onPress={onBack} label="Back" />
        <View className="ml-3">
          <Text className="text-xs font-semibold text-ink-muted">{subtitle}</Text>
          <Text className="text-xl font-bold text-ink">Choose a language</Text>
        </View>
      </View>

      <View className="flex-row items-center rounded-xl border border-line bg-chip px-3">
        <MaterialCommunityIcons name="magnify" size={20} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages"
          placeholderTextColor={colors.placeholder}
          autoCorrect={false}
          className="ml-2 h-11 flex-1 text-[15px] text-ink"
        />
      </View>

      <ScrollView className="mt-1 flex-1" keyboardShouldPersistTaps="handled">
        {sections.map((s) => (
          <View key={s.key}>
            <SectionLabel>{s.title}</SectionLabel>
            {s.items.map((l) => (
              <LanguageRow
                key={l.code}
                language={l}
                selected={l.code === selectedCode}
                showOfflineBadge={s.badge}
                onPress={() => onSelect(l.code)}
              />
            ))}
          </View>
        ))}
        {!sections.length && (
          <Text className="mt-6 text-center text-ink-muted">No languages match “{query}”.</Text>
        )}
      </ScrollView>
    </View>
  );
}
