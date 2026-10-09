import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DURATION = 250;
const useNativeDriver = Platform.OS !== 'web';

/**
 * Slide-up sheet over a dimmed backdrop. Tapping the backdrop calls onClose.
 * fullHeight: stretch to near the top of the screen (e.g. for long lists).
 */
export default function BottomSheet({ visible, onClose, fullHeight = false, children }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [800, 0] });

  return (
    <Modal transparent visible={mounted} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* NativeWind doesn't style Animated.View, so classes live on the inner Views. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable className="flex-1 bg-scrim" onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight: '94%',
            height: fullHeight ? '94%' : undefined,
          }}
        >
          <View className="flex-shrink rounded-t-3xl bg-surface" style={{ paddingBottom: insets.bottom + 12, flexGrow: fullHeight ? 1 : 0 }}>
            <View className="items-center pb-1 pt-2.5">
              <View className="h-1 w-10 rounded-full bg-line" />
            </View>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
