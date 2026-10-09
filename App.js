import './global.css';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import PlanScreen from './src/screens/PlanScreen';
import RideScreen from './src/screens/RideScreen';
import GuideScreen from './src/screens/GuideScreen';
import TranslateScreen from './src/screens/TranslateScreen';

const TABS = [
  { key: 'plan', label: 'Plan', Screen: PlanScreen },
  { key: 'ride', label: 'Ride', Screen: RideScreen },
  { key: 'guide', label: 'Guide', Screen: GuideScreen },
  { key: 'translate', label: 'Translate', Screen: TranslateScreen },
];

export default function App() {
  const [active, setActive] = useState('plan');
  const { Screen } = TABS.find((t) => t.key === active);

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-bold text-slate-900">Biyahe Buddy</Text>
          <Text className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
            On-device AI: not loaded
          </Text>
        </View>

        <View className="flex-1">
          <Screen />
        </View>

        <View className="flex-row border-t border-slate-200 bg-white">
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setActive(t.key)} className="flex-1 items-center py-3">
              <Text className={active === t.key ? 'font-semibold text-blue-600' : 'text-slate-500'}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
