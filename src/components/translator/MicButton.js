import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Press-and-hold to talk. The halo grows while listening.
export default function MicButton({ listening, onPressIn, onPressOut }) {
  const halo = listening ? 108 : 96;

  return (
    <View className="items-center">
      <View className="h-[112px] items-center justify-center">
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Hold to speak"
          className="items-center justify-center rounded-full bg-duck-soft"
          style={{ width: halo, height: halo, borderRadius: halo / 2 }}
        >
          <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-duck">
            <MaterialCommunityIcons name="microphone-outline" size={34} color={colors.ink} />
          </View>
        </Pressable>
      </View>
      <Text className="mt-1 text-center text-sm font-medium text-ok-text">
        {listening ? 'Listening… release to translate' : 'Hold to speak'}
      </Text>
    </View>
  );
}
