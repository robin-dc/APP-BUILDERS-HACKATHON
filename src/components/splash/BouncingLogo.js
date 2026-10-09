import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import DuckLogo from '../DuckLogo';
import { colors } from '../../theme/colors';

const useNativeDriver = Platform.OS !== 'web';

// Tune the motion here.
const BOUNCE_HEIGHT = 7; // px the logo rises
const BOUNCE_MS = 750; // one way (up or down)
const RIPPLE_MS = 2200; // one ripple's life
const RIPPLE_COUNT = 3; // ripples in flight at once
const RIPPLE_GROW = 0.32; // how far a ripple spreads (fraction of its size)

function loop(anim) {
  const l = Animated.loop(anim);
  l.start();
  return l;
}

/**
 * Logo that bobs gently while its border breathes and sends out
 * water-like ripples.
 */
export default function BouncingLogo({ size = 104 }) {
  const ring = size * 1.26; // border box around the tile
  const ringRadius = ring * 0.3;

  const bounce = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const ripples = useRef(Array.from({ length: RIPPLE_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const running = [
      loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: BOUNCE_MS, easing: ease, useNativeDriver }),
          Animated.timing(bounce, { toValue: 0, duration: BOUNCE_MS, easing: ease, useNativeDriver }),
        ])
      ),
      loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: BOUNCE_MS, easing: ease, useNativeDriver }),
          Animated.timing(breathe, { toValue: 0, duration: BOUNCE_MS, easing: ease, useNativeDriver }),
        ])
      ),
      ...ripples.map((r, i) =>
        loop(
          Animated.sequence([
            Animated.delay((RIPPLE_MS / RIPPLE_COUNT) * i),
            Animated.timing(r, {
              toValue: 1,
              duration: RIPPLE_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver,
            }),
            Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver }),
          ])
        )
      ),
    ];
    return () => running.forEach((l) => l.stop());
  }, [bounce, breathe, ripples]);

  const ringStyle = {
    position: 'absolute',
    width: ring,
    height: ring,
    borderRadius: ringRadius,
    borderWidth: 1.5,
    borderColor: colors.splashRing,
  };

  return (
    <View style={{ width: ring * (1 + RIPPLE_GROW), height: ring * (1 + RIPPLE_GROW) }} className="items-center justify-center">
      {ripples.map((r, i) => (
        <Animated.View
          key={i}
          style={[
            ringStyle,
            {
              opacity: r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
              transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + RIPPLE_GROW] }) }],
            },
          ]}
        />
      ))}

      {/* main border, swelling softly in time with the bounce */}
      <Animated.View
        style={[
          ringStyle,
          {
            backgroundColor: 'rgba(255, 201, 60, 0.06)',
            transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
          },
        ]}
      />

      <Animated.View
        style={{
          transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -BOUNCE_HEIGHT] }) }],
        }}
      >
        <DuckLogo size={size} />
      </Animated.View>
    </View>
  );
}
