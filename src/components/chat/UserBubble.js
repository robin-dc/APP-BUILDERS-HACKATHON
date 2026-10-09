import { Text, View } from 'react-native';

export default function UserBubble({ text }) {
  return (
    <View className="mb-4 items-end">
      <View className="max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-3">
        <Text className="text-[15px] leading-6 text-white">{text}</Text>
      </View>
    </View>
  );
}
