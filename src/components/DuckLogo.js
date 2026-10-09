import { View } from 'react-native';
import { colors } from '../theme/colors';

// App logo: yellow tile with a duck riding a row of dots. Every measurement
// is a fraction of `size`, so it scales cleanly.
export default function DuckLogo({ size = 100 }) {
  const s = (f) => f * size;
  const dot = s(0.045);

  return (
    <View style={{ width: size, height: size, borderRadius: s(0.28), backgroundColor: colors.duck }}>
      {/* tail */}
      <View
        style={{
          position: 'absolute',
          left: s(0.22),
          top: s(0.4),
          width: s(0.14),
          height: s(0.14),
          backgroundColor: colors.ink,
          borderTopLeftRadius: s(0.02),
          transform: [{ rotate: '45deg' }],
        }}
      />
      {/* body */}
      <View
        style={{
          position: 'absolute',
          left: s(0.22),
          top: s(0.43),
          width: s(0.56),
          height: s(0.24),
          borderRadius: s(0.12),
          borderTopLeftRadius: s(0.04),
          backgroundColor: colors.ink,
        }}
      />
      {/* head */}
      <View
        style={{
          position: 'absolute',
          left: s(0.43),
          top: s(0.2),
          width: s(0.27),
          height: s(0.27),
          borderRadius: s(0.135),
          backgroundColor: colors.ink,
        }}
      />
      {/* eye */}
      <View
        style={{
          position: 'absolute',
          left: s(0.58),
          top: s(0.28),
          width: s(0.045),
          height: s(0.045),
          borderRadius: s(0.0225),
          backgroundColor: colors.duck,
        }}
      />
      {/* beak */}
      <View
        style={{
          position: 'absolute',
          left: s(0.67),
          top: s(0.31),
          width: s(0.13),
          height: s(0.07),
          borderTopRightRadius: s(0.035),
          borderBottomRightRadius: s(0.035),
          backgroundColor: colors.beak,
        }}
      />
      {/* dots (water / rail line) */}
      <View
        style={{
          position: 'absolute',
          top: s(0.75),
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: s(0.035),
        }}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <View
            key={i}
            style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.ink }}
          />
        ))}
      </View>
    </View>
  );
}
