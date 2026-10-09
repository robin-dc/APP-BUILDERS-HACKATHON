import { View } from 'react-native';
import DuckAvatar from '../DuckAvatar';

// Row with the duck avatar on the left. Pass `showAvatar={false}` for follow-up
// blocks in the same reply so they line up under the first one.
export default function AssistantMessage({ showAvatar = true, children }) {
  return (
    <View className="mb-4 flex-row">
      <View className="mr-3 w-7 pt-0.5">{showAvatar && <DuckAvatar size={26} />}</View>
      <View className="flex-1">{children}</View>
    </View>
  );
}
