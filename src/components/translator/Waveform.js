import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { colors } from '../../theme/colors';

// Bar heights at rest, left to right. Edit to change the shape.
const BARS = [10, 16, 24, 32, 22, 30, 18, 26, 14, 10];
const useNativeDriver = Platform.OS !== 'web';

// Voice-level bars. Pulses while `active`, sits faded and still otherwise.
export default function Waveform({ active }) {
  const scales = useRef(BARS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (!active) {
      scales.forEach((s) => s.setValue(1));
      return;
    }
    const loops = scales.map((s, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(s, { toValue: 0.4, duration: 300, useNativeDriver }),
          Animated.timing(s, { toValue: 1, duration: 300, useNativeDriver }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, scales]);

  return (
    <View className={`h-9 flex-row items-center justify-center gap-1 ${active ? '' : 'opacity-30'}`}>
      {BARS.map((h, i) => (
        // Plain style here: NativeWind doesn't apply className to Animated.View.
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            backgroundColor: colors.wave,
            transform: [{ scaleY: scales[i] }],
          }}
        />
      ))}
    </View>
  );
}
