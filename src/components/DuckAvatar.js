import { View } from 'react-native';

// Mascot drawn with plain Views so it scales with `size` and needs no image asset.
export default function DuckAvatar({ size = 28 }) {
  const eye = size * 0.12;
  const beakW = size * 0.34;
  const beakH = size * 0.2;

  return (
    <View className="bg-duck" style={{ width: size, height: size, borderRadius: size / 2 }}>
      <View
        className="absolute rounded-full bg-ink"
        style={{ width: eye, height: eye, top: size * 0.36, left: size * 0.3 }}
      />
      <View
        className="absolute bg-duck-beak"
        style={{
          width: beakW,
          height: beakH,
          borderRadius: beakH / 2,
          top: size * 0.5,
          left: -beakW * 0.35,
        }}
      />
    </View>
  );
}
