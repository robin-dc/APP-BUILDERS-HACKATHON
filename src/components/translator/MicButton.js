import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Press-and-hold to talk. The halo grows while listening.
export default function MicButton({ listening, starting, onPress }) {
  const halo = listening ? 108 : 96;

  return (
    <View className="items-center">
      <View className="h-[112px] items-center justify-center">
        <Pressable
          onPress={onPress}
          disabled={starting}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Start speaking'}
          className={`items-center justify-center rounded-full bg-duck-soft ${
            starting ? 'opacity-60' : ''
          }`}
          style={{ width: halo, height: halo, borderRadius: halo / 2 }}
        >
          <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-duck">
            {starting ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <MaterialCommunityIcons
                name={listening ? 'stop' : 'microphone-outline'}
                size={34}
                color={colors.ink}
              />
            )}
          </View>
        </Pressable>
      </View>
      <Text className="mt-1 text-center text-sm font-medium text-ok-text">
        {starting
          ? 'Requesting microphone…'
          : listening
            ? 'Listening… tap to finish'
            : 'Tap to speak'}
      </Text>
    </View>
  );
}
