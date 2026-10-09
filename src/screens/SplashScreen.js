import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BouncingLogo from '../components/splash/BouncingLogo';
import { colors } from '../theme/colors';

const LOAD_MS = 1800; // progress bar fill
const FADE_MS = 300; // fade into the app (total ≈ 2.1s)

/**
 * Startup screen. Fills the progress bar, fades out, then calls onFinish.
 * TODO: drive `progress` from real model loading instead of a timer.
 */
export default function SplashScreen({ onFinish, status = 'Waking up on-device AI...' }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setPercent(Math.round(value * 100)));
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: LOAD_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animates width
      }),
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(({ finished }) => finished && onFinish?.());
    return () => progress.removeListener(id);
  }, [progress, fade, onFinish]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <View
        className="flex-1 bg-ink px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
      >
        <View className="flex-1 items-center justify-center">
          <BouncingLogo size={104} />
          <Text className="mt-4 text-[34px] font-extrabold text-white">
            Travel <Text className="text-duck">Ducky</Text>
          </Text>
          <Text className="mt-1 text-[15px] text-night-text">Your offline biyahe buddy</Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] font-semibold text-white">{status}</Text>
          <Text className="text-[13px] font-semibold text-duck">{percent}%</Text>
        </View>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-night-track">
          <Animated.View
            style={{
              height: '100%',
              borderRadius: 999,
              backgroundColor: colors.duck,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>

        <View className="mt-4 flex-row items-center justify-center">
          <MaterialCommunityIcons name="lock-outline" size={13} color="#B8C1D6" />
          <Text className="ml-1.5 text-xs text-night-text">Runs on your phone · works offline</Text>
        </View>
      </View>
    </Animated.View>
  );
}
